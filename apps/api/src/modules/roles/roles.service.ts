import {
  BadRequestException,
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

  async createCustomRole(
    tenantId: string,
    name: string,
    permissionIds: string[],
  ): Promise<Role> {
    if (!name?.trim()) {
      throw new BadRequestException("Rol nomi bo'sh bo'lishi mumkin emas");
    }
    const permissions = await this.permissionsService.findAll();
    const selected = permissions.filter((p) => permissionIds.includes(p.id));
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
    roleId: string,
    permissionIds: string[],
  ): Promise<Role> {
    const permissions = await this.permissionsService.findAll();
    return this.withTenantContext(tenantId, async (manager) => {
      const roleRepo = manager.getRepository(Role);
      const role = await roleRepo.findOne({
        where: { id: roleId, tenantId },
        relations: { permissions: true },
      });
      if (!role) throw new NotFoundException('Rol topilmadi');

      role.permissions = permissions.filter((p) =>
        permissionIds.includes(p.id),
      );
      return roleRepo.save(role);
    });
  }

  async assignRoleToUser(
    tenantId: string,
    userId: string,
    roleId: string,
    propertyId: string | null = null,
  ): Promise<UserRole> {
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

    const relevant = userRoles.filter(
      (ur) =>
        ur.propertyId === null || !propertyId || ur.propertyId === propertyId,
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
