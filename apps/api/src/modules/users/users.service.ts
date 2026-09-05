import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SalaryType, User, UserStatus } from './entities/user.entity';
import { nullable } from '../../common/utils/typeorm.util';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // 🔴 `users` jadvalida RLS bor (migratsiya 1789300000000). Bu servis
  // RolesService/TenantsService bilan BIR XIL naqshni ishlatadi: ambient
  // so'rov-kontekstiga (RlsContextService) tayanmaydi, balki HAR BIR
  // metodda o'z tranzaksiyasini ochib, ichida `set_config` qiladi.
  //
  // Nima uchun ambient kontekst YARAMAYDI (mahalliy sinovda aniqlandi):
  // agar `UsersService` so'rov tranzaksiyasiga qo'shilsa, `registerTenant`
  // oqimida yaratilgan foydalanuvchi hali COMMIT bo'lmagan bo'ladi, keyin
  // `RolesService.assignRoleToUser` esa O'Z tranzaksiyasida (boshqa
  // ulanishda) ishlaydi va `user_roles` FK'si "user topilmadi" deb
  // yiqiladi. RolesService ham aynan shu sababdan o'z tranzaksiyasini
  // ochadi.
  //
  // Ikkita yordamchi:
  //   `withTenant`  — tenant konteksti bilan (odatiy, himoyalangan yo'l)
  //   `withBypass`  — kontekstsiz (login/registratsiya), pastdagi izohga qarang
  private async withTenant<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.userRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', [
        'app.tenant_id',
        tenantId,
      ]);
      return fn(manager);
    });
  }

  // Uchta amal TENANT KONTEKSTIDAN TASHQARIDA bajarilishi SHART:
  //   * `findAllByEmail` / `findByEmailAndTenant` — login: foydalanuvchi
  //     qaysi tenantda ekani hali NOMA'LUM (email turli tenantlarda
  //     takrorlanishi mumkin), demak kontekst ham yo'q.
  //   * `createUser` — `registerTenant` oqimida, autentifikatsiyadan oldin.
  //   * `findById` — platforma admini uchun (`tenant_id IS NULL`, hech qanday
  //     tenant siyosatiga tushmaydi) va `/auth/me` uchun.
  //
  // Chetlab o'tish ANIQ nomlangan (`app.users_bypass`) va faqat shu
  // tranzaksiya ichida amal qiladi — ya'ni "kontekst yo'q ⇒ hamma narsa
  // ko'rinadi" degan yashirin qoida EMAS. Qolgan hamma metod
  // (`listByTenant`, `resetPassword`, `updateStatus`, `setSalary`,
  // `getSalary`, `listActiveWithSalary`) odatdagi tenant siyosati ostida
  // qoladi — aynan ular unutilgan filtr xavfi bo'lgan joylar.
  private async withBypass<T>(
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.userRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', [
        'app.users_bypass',
        'on',
      ]);
      return fn(manager);
    });
  }

  async createUser(params: {
    tenantId: string | null;
    email: string;
    password: string;
    fullName: string;
    isPlatformAdmin?: boolean;
    position?: string;
  }): Promise<User> {
    const normalizedEmail = params.email.trim().toLowerCase();

    // `registerTenant` oqimida bu metod autentifikatsiyadan OLDIN
    // chaqiriladi — tenant konteksti hali yo'q (qarang: withBypass izohi).
    const existing = await this.withBypass((m) =>
      m.getRepository(User).findOneBy({
        tenantId: nullable(params.tenantId),
        email: normalizedEmail,
      }),
    );
    if (existing) {
      throw new ConflictException(
        'Bu email bilan foydalanuvchi allaqachon mavjud',
      );
    }

    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      tenantId: params.tenantId,
      email: normalizedEmail,
      passwordHash,
      fullName: params.fullName,
      status: UserStatus.ACTIVE,
      isPlatformAdmin: params.isPlatformAdmin ?? false,
      position: params.position?.trim() || null,
    });
    return this.withBypass((m) => m.getRepository(User).save(user));
  }

  async findByEmailAndTenant(
    email: string,
    tenantId: string | null,
  ): Promise<User | null> {
    return this.withBypass((m) =>
      m.getRepository(User).findOneBy({
        email: email.trim().toLowerCase(),
        tenantId: nullable(tenantId),
      }),
    );
  }

  // Login sahifasi qayta dizayni (2026-09): subdomain endi talab qilinmaydi.
  // Email bitta tenant ichida unique (@Unique(['tenantId','email'])), lekin
  // turli tenant'larda bir xil email bo'lishi mumkin — shuning uchun bu metod
  // BARCHA tenant'lardagi (va platforma admin, tenantId=null) mos foydalanuvchi
  // qatorlarini qaytaradi; qaysi biri to'g'ri ekanini AuthService parol
  // tekshiruvi orqali aniqlaydi.
  async findAllByEmail(email: string): Promise<User[]> {
    return this.withBypass((m) =>
      m.getRepository(User).find({ where: { email: email.trim().toLowerCase() } }),
    );
  }

  // ESLATMA: bu metod tenant olmaydi, ya'ni o'zi izolyatsiya bermaydi.
  // Chaqiruvchilar (`AttendanceService`, `LeaveRequestsService`) natijadagi
  // `user.tenantId` ni o'zlari solishtiradi; `/auth/me` esa JWT'dagi o'z
  // id'sini beradi. Platforma admini (`tenant_id IS NULL`) hech qanday
  // tenant siyosatiga tushmagani uchun ham bypass shart.
  async findById(id: string): Promise<User | null> {
    return this.withBypass((m) => m.getRepository(User).findOneBy({ id }));
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return this.withTenant(tenantId, (m) =>
      m.getRepository(User).find({
        where: { tenantId },
        order: { createdAt: 'ASC' },
      }),
    );
  }

  // Xodimlar sahifasi (2026-09): administrator tomonidan yangi parol
  // o'rnatish — interim yechim, chunki hozircha email orqali o'z-o'zini
  // xizmat ko'rsatish parol tiklash mavjud emas. `tenantId` chaqiruvchining
  // (@CurrentUser) autentifikatsiyalangan tenant'idan keladi — boshqa
  // tenant'ning foydalanuvchisini o'zgartirib bo'lmaydi.
  async resetPassword(
    tenantId: string,
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.withTenant(tenantId, async (m) => {
      const repo = m.getRepository(User);
      const user = await repo.findOneBy({ id: userId, tenantId });
      if (!user) throw new NotFoundException('Xodim topilmadi');
      user.passwordHash = passwordHash;
      await repo.save(user);
    });
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    status: UserStatus,
  ): Promise<User> {
    return this.withTenant(tenantId, async (m) => {
      const repo = m.getRepository(User);
      const user = await repo.findOneBy({ id: userId, tenantId });
      if (!user) throw new NotFoundException('Xodim topilmadi');
      user.status = status;
      return repo.save(user);
    });
  }

  // Payroll moduli (2026-09): Xodimlar sahifasidagi "Maosh belgilash" orqali
  // chaqiriladi. Har doim TO'LIQ juftlik (tur + summa) sifatida o'rnatiladi —
  // qisman/bo'sh qiymat yubormaydi (frontend `SetSalaryModal` majburiy
  // maydonlar bilan yuboradi).
  async setSalary(
    tenantId: string,
    userId: string,
    salaryType: SalaryType,
    salaryAmount: string,
  ): Promise<User> {
    return this.withTenant(tenantId, async (m) => {
      const repo = m.getRepository(User);
      const user = await repo.findOneBy({ id: userId, tenantId });
      if (!user) throw new NotFoundException('Xodim topilmadi');
      user.salaryType = salaryType;
      user.salaryAmount = salaryAmount;
      return repo.save(user);
    });
  }

  async getSalary(
    tenantId: string,
    userId: string,
  ): Promise<{ salaryType: SalaryType | null; salaryAmount: string | null }> {
    return this.withTenant(tenantId, async (m) => {
      const user = await m
        .getRepository(User)
        .findOneBy({ id: userId, tenantId });
      if (!user) throw new NotFoundException('Xodim topilmadi');
      return { salaryType: user.salaryType, salaryAmount: user.salaryAmount };
    });
  }

  // PayrollService.createRun uchun: shu tenant'dagi faol va maoshi
  // belgilangan xodimlar ro'yxati (payroll'ga avtomatik kiritish uchun).
  async listActiveWithSalary(tenantId: string): Promise<User[]> {
    const users = await this.withTenant(tenantId, (m) =>
      m.getRepository(User).find({
        where: { tenantId, status: UserStatus.ACTIVE },
        order: { fullName: 'ASC' },
      }),
    );
    return users.filter(
      (u) => u.salaryType !== null && u.salaryAmount !== null,
    );
  }
}
