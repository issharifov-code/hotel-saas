import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { Permission } from './entities/permission.entity';
import { PermissionsService } from './permissions.service';
import { SYSTEM_ROLE_DEFINITIONS } from '../../common/constants/role-permission-matrix';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';
import { nullable } from '../../common/utils/typeorm.util';

@Injectable()
export class RolesService {
  // DIQQAT: `roleRepo`ning o'zi (Role uchun) emas, balki uning `.manager`i
  // (butun DataSource'ning umumiy EntityManager'i) ishlatiladi — `roles` va
  // `user_roles` uchun HAMMA haqiqiy o'qish/yozish `withTenantContext()`
  // ochgan tranzaksiya ichida, `manager.getRepository(Role/UserRole)` orqali
  // sodir bo'ladi (pastga qarang). Shu sabab `UserRole` uchun alohida
  // repository inject qilinmagan — kerak emas.
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    private readonly permissionsService: PermissionsService,
  ) {}

  // `roles`/`user_roles` 2026-08-24'dan boshlab Row-Level Security bilan
  // himoyalangan (EnableRowLevelSecurityRoles migratsiyasi). Runtime ulanish
  // (`hotel_saas_app` roli) jadval egasi EMAS, shuning uchun RLS siyosati har
  // doim qo'llaniladi — `current_setting('app.tenant_id', true)` o'rnatilmagan
  // tranzaksiyada bu jadvallardan HECH NARSA qaytmaydi/yozilmaydi.
  //
  // Boshqa RLS-himoyalangan modullardan farqli o'laroq (ular so'rov-darajasidagi
  // ambient RlsContextService'ga tayanadi — qarang: common/rls/), RolesService
  // buni ATAYLAB O'ZI, har bir metod ichida qo'lda hal qiladi: chunki bu servis
  // AUTENTIFIKATSIYADAN OLDIN ham (AuthService.registerTenant — yangi tenant
  // uchun standart rollarni seed qilish/egasini tayinlash hali login qilinmagan
  // holatda sodir bo'ladi) chaqiriladi, ambient so'rov-kontekstisiz. Naqsh
  // TenantsService.createTenantWithDefaultProperty bilan bir xil: o'z
  // tranzaksiyasini ochib, ichida qo'lda `set_config` chaqiradi.
  private async withTenantContext<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.roleRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', [
        'app.tenant_id',
        tenantId,
      ]);
      return fn(manager);
    });
  }

  // Yangi tenant ro'yxatdan o'tganda chaqiriladi: 6 ta standart rolni
  // (Egasi, Buxgalter, Front Desk, Housekeeping, Ombor mudiri, POS) avtomatik yaratadi.
  async seedSystemRolesForTenant(tenantId: string): Promise<Role[]> {
    const allPermissions =
      await this.permissionsService.ensureAllPermissionsExist();
    const permissionKey = (m: PermissionModule, a: PermissionAction) =>
      `${m}:${a}`;
    const permissionMap = new Map<string, Permission>(
      allPermissions.map((p) => [permissionKey(p.module, p.action), p]),
    );

    return this.withTenantContext(tenantId, async (manager) => {
      const roleRepo = manager.getRepository(Role);
      const createdRoles: Role[] = [];
      for (const def of SYSTEM_ROLE_DEFINITIONS) {
        const permissions: Permission[] = [];
        for (const group of def.permissions) {
          for (const action of group.actions) {
            const perm = permissionMap.get(permissionKey(group.module, action));
            if (perm) permissions.push(perm);
          }
        }
        const role = roleRepo.create({
          tenantId,
          name: def.name,
          systemKey: def.key,
          isSystem: true,
          permissions,
        });
        createdRoles.push(await roleRepo.save(role));
      }
      return createdRoles;
    });
  }

  async listRolesForTenant(tenantId: string): Promise<Role[]> {
    return this.withTenantContext(tenantId, (manager) =>
      manager.getRepository(Role).find({
        where: { tenantId },
        relations: { permissions: true },
        order: { createdAt: 'ASC' },
      }),
    );
  }

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Rol boshqaruvida uchta
  // mustaqil tekshiruv yo'q edi va ular birlashib TO'LIQ TENANT EGALLASHGA
  // olib kelardi. `users_roles:create` + `users_roles:edit` ruxsatiga ega
  // xodim (masalan yangi xodimlarni rasmiylashtirish uchun shu ruxsat
  // berilgan menejer):
  //
  //   1. `GET /api/permissions` (o'sha paytda ruxsatsiz ochiq edi) bilan
  //      barcha 65 ta ruxsat UUID'sini oladi;
  //   2. `POST /roles` bilan HAMMA ruxsatga ega rol yaratadi — chunki
  //      ruxsatlar global jadvaldan olinardi va yaratuvchining o'z
  //      ruxsatlariga nisbatan hech qanday tekshiruv yo'q edi;
  //   3. `POST /user-roles` bilan uni O'ZIGA biriktiradi — o'zini
  //      tekshirish ham yo'q edi.
  //
  // Natijada `tenant_settings:delete`, `accounting:approve`, `payroll:edit`
  // — ya'ni amalda Owner huquqlari. Alohida: `updateRolePermissions`
  // `role.isSystem` ni umuman o'qimasdi (bayroq kodda hech qayerda
  // o'qilmasdi), ya'ni Owner rolining ruxsatlarini bo'shatib, haqiqiy
  // egani o'z mehmonxonasidan qulflab qo'yish mumkin edi.
  //
  // Qoida endi sanoat standarti bilan bir xil: O'ZINGDA YO'Q RUXSATNI
  // BERA OLMAYSAN. Owner'da hamma ruxsat bor, shuning uchun uning
  // ishiga ta'sir qilmaydi.
  private async assertPermissionsWithinActorGrant(
    tenantId: string,
    actorUserId: string,
    permissionIds: string[],
  ): Promise<Permission[]> {
    const all = await this.permissionsService.findAll();
    const selected = all.filter((p) => permissionIds.includes(p.id));

    const actorPermissions = await this.getEffectivePermissions(
      tenantId,
      actorUserId,
    );
    const beyond = selected.filter(
      (p) => !actorPermissions.has(`${p.module}:${p.action}`),
    );
    if (beyond.length > 0) {
      throw new ForbiddenException(
        "O'zingizda yo'q ruxsatni rolga qo'sha olmaysiz: " +
          beyond.map((p) => `${p.module}.${p.action}`).join(', '),
      );
    }
    return selected;
  }

  async createCustomRole(
    tenantId: string,
    actorUserId: string,
    name: string,
    permissionIds: string[],
  ): Promise<Role> {
    if (!name?.trim()) {
      throw new BadRequestException("Rol nomi bo'sh bo'lishi mumkin emas");
    }
    const selected = await this.assertPermissionsWithinActorGrant(
      tenantId,
      actorUserId,
      permissionIds,
    );
    return this.withTenantContext(tenantId, (manager) => {
      const roleRepo = manager.getRepository(Role);
      const role = roleRepo.create({
        tenantId,
        name: name.trim(),
        isSystem: false,
        permissions: selected,
      });
      return roleRepo.save(role);
    });
  }

  async updateRolePermissions(
    tenantId: string,
    actorUserId: string,
    roleId: string,
    permissionIds: string[],
  ): Promise<Role> {
    const selected = await this.assertPermissionsWithinActorGrant(
      tenantId,
      actorUserId,
      permissionIds,
    );
    return this.withTenantContext(tenantId, async (manager) => {
      const roleRepo = manager.getRepository(Role);
      const role = await roleRepo.findOne({
        where: { id: roleId, tenantId },
        relations: { permissions: true },
      });
      if (!role) throw new NotFoundException('Rol topilmadi');

      // Tizim rollari (Egasi, Buxgalter, ...) o'zgarmas: entity izohi ham
      // shuni aytadi, lekin bayroq hech qayerda tekshirilmasdi.
      if (role.isSystem) {
        throw new ForbiddenException(
          "Tizim rolining ruxsatlarini o'zgartirib bo'lmaydi — yangi maxsus rol yarating",
        );
      }

      role.permissions = selected;
      return roleRepo.save(role);
    });
  }

  async assignRoleToUser(
    tenantId: string,
    userId: string,
    roleId: string,
    propertyId: string | null = null,
    // Ixtiyoriy: `registerTenant` oqimida chaqiruvchi hali yo'q (egasiga
    // birinchi rolni tizimning o'zi biriktiradi). Berilgan holatda esa
    // yuqoridagi eskalatsiya tekshiruvlari qo'llanadi.
    actorUserId?: string,
  ): Promise<UserRole> {
    if (actorUserId) {
      if (actorUserId === userId) {
        throw new ForbiddenException(
          "O'zingizga rol biriktira olmaysiz — buni boshqa administrator qilishi kerak",
        );
      }
      const role = await this.getRoleWithPermissions(tenantId, roleId);
      await this.assertPermissionsWithinActorGrant(
        tenantId,
        actorUserId,
        role.permissions.map((p) => p.id),
      );
    }

    return this.withTenantContext(tenantId, async (manager) => {
      const roleRepo = manager.getRepository(Role);
      const userRoleRepo = manager.getRepository(UserRole);

      const role = await roleRepo.findOneBy({ id: roleId, tenantId });
      if (!role) throw new NotFoundException('Rol topilmadi');

      const existing = await userRoleRepo.findOneBy({
        tenantId,
        userId,
        roleId,
        propertyId: nullable(propertyId),
      });
      if (existing) return existing;

      const userRole = userRoleRepo.create({
        tenantId,
        userId,
        roleId,
        propertyId,
      });
      return userRoleRepo.save(userRole);
    });
  }

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Tenant CHEGARASI to'g'ri
  // edi (boshqa tenantning xodimiga tegib bo'lmaydi), lekin tenant ICHIDA
  // hech qanday ierarxiya yo'q edi: `users_roles:edit` ruxsatiga ega
  // menejer `PATCH /users/<ega>/reset-password` bilan Egasining parolini
  // almashtirib, uning hisobiga kirib olardi. Bu ayniqsa samarali edi,
  // chunki parol almashtirish `token_version` ni oshiradi — ya'ni haqiqiy
  // ega o'sha zahoti tizimdan chiqib ketardi va nima bo'lganini
  // tushunmasdan yangi parol so'rardi.
  //
  // Qoida: NISHONNING ruxsatlari CHAQIRUVCHINIKIDAN oshib ketmasligi
  // kerak. Ega hamma ruxsatga ega, shuning uchun u hech kim tomonidan
  // "boshqarib" bo'lmaydi, o'zi esa hammani boshqara oladi.
  async assertActorOutranksTarget(
    tenantId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    // O'z hisobiga tegish cheklanmaydi (masalan o'z parolini almashtirish).
    if (actorUserId === targetUserId) return;

    const [actorPermissions, targetPermissions] = await Promise.all([
      this.getEffectivePermissions(tenantId, actorUserId),
      this.getEffectivePermissions(tenantId, targetUserId),
    ]);

    const beyond = [...targetPermissions].filter((p) => !actorPermissions.has(p));
    if (beyond.length > 0) {
      throw new ForbiddenException(
        "Bu xodimning ruxsatlari sizdan keng — uning hisobini o'zgartira olmaysiz",
      );
    }
  }

  private async getRoleWithPermissions(
    tenantId: string,
    roleId: string,
  ): Promise<Role> {
    const role = await this.withTenantContext(tenantId, (manager) =>
      manager.getRepository(Role).findOne({
        where: { id: roleId, tenantId },
        relations: { permissions: true },
      }),
    );
    if (!role) throw new NotFoundException('Rol topilmadi');
    return role;
  }

  async removeRoleFromUser(
    tenantId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    await this.withTenantContext(tenantId, async (manager) => {
      await manager
        .getRepository(UserRole)
        .delete({ tenantId, userId, roleId });
    });
  }

  // Foydalanuvchining barcha rollari orqali erishadigan ruxsatlar to'plami (union).
  // propertyId berilsa: tenant-darajasidagi (propertyId=null) rollar + shu mulkka
  // tegishli rollar hisobga olinadi.
  //
  // MUHIM: bu metod PermissionsGuard tomonidan DEYARLI HAR BIR himoyalangan
  // so'rovda chaqiriladi — shuning uchun o'zining tranzaksiyasini o'zi ochishi
  // (withTenantContext orqali) global RlsTransactionInterceptor'ning so'rov
  // hayot davri tartibiga (Guard -> Interceptor -> Handler) BOG'LIQ EMAS.
  // Agar bu servis o'rniga ambient RlsContextService'ga tayangan bo'lsa edi,
  // PermissionsGuard (interceptor'dan OLDIN ishlaydigan Guard) tenant konteksti
  // hali o'rnatilmagan holda so'rov yuborgan bo'lardi.
  async getEffectivePermissions(
    tenantId: string,
    userId: string,
    propertyId?: string,
  ): Promise<Set<string>> {
    const userRoles = await this.withTenantContext(tenantId, (manager) =>
      manager.getRepository(UserRole).find({
        where: { tenantId, userId },
        relations: { role: { permissions: true } },
      }),
    );

    // 🔴 2026-09-05 (audit): ilgari bu yerda `|| !propertyId` sharti bor edi,
    // ya'ni so'rovda `propertyId` bo'lmasa (tenant darajasidagi yo'llar —
    // /users, /roles, /user-roles, /guests, /stock-items ...) HAMMA rol
    // hisobga olinardi. Natijada mulkka biriktirilgan rol o'z chegarasidan
    // jimgina chiqib ketardi: faqat bitta filialga biriktirilgan buxgalter
    // `PATCH /users/:id/salary` orqali butun tenantdagi har bir xodimning
    // maoshini ko'rib, o'zgartira olardi.
    //
    // Endi qoida sodda: TENANT darajasidagi amal uchun TENANT darajasidagi
    // rol kerak. Mulkka biriktirilgan rol faqat o'z mulkining yo'llarida
    // ishlaydi.
    //
    // Bu bugungi ma'lumotni buzmaydi: interfeys rol biriktirishda
    // `propertyId` yubormaydi (StaffPage), ya'ni mavjud barcha
    // biriktirishlar tenant darajasida (`property_id IS NULL`).
    const relevant = userRoles.filter((ur) =>
      ur.propertyId === null
        ? true
        : propertyId !== undefined && ur.propertyId === propertyId,
    );

    const result = new Set<string>();
    for (const ur of relevant) {
      for (const perm of ur.role.permissions) {
        result.add(`${perm.module}:${perm.action}`);
      }
    }
    return result;
  }

  async getRoleById(tenantId: string, roleId: string): Promise<Role> {
    return this.withTenantContext(tenantId, async (manager) => {
      const role = await manager.getRepository(Role).findOne({
        where: { id: roleId, tenantId },
        relations: { permissions: true },
      });
      if (!role) throw new NotFoundException('Rol topilmadi');
      return role;
    });
  }

  async findRolesByIds(tenantId: string, ids: string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    return this.withTenantContext(tenantId, (manager) =>
      manager.getRepository(Role).find({ where: { tenantId, id: In(ids) } }),
    );
  }

  // Xodimlar sahifasida har bir foydalanuvchiga qaysi rol(lar) tayinlanganini
  // ko'rsatish uchun — frontend buni allaqachon yuklangan `roles` ro'yxati bilan
  // (roleId orqali) birlashtiradi, shuning uchun bu yerda relation kerak emas.
  async listUserRoleAssignments(tenantId: string): Promise<UserRole[]> {
    return this.withTenantContext(tenantId, (manager) =>
      manager.getRepository(UserRole).find({ where: { tenantId } }),
    );
  }
}
