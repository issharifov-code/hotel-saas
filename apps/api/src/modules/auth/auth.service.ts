import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../roles/roles.service';
import { SampleDataService } from '../sample-data/sample-data.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { SystemRoleKey } from '../../common/enums/permission.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { Tenant } from '../tenants/entities/tenant.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly rolesService: RolesService,
    private readonly sampleDataService: SampleDataService,
    private readonly jwtService: JwtService,
  ) {}

  // Onboarding: yangi mehmonxona ro'yxatdan o'tkazish (6.1-bo'lim, self-service).
  // Tenant + default Property + 6 ta standart rol + Owner foydalanuvchi bitta oqimda yaratiladi.
  async registerTenant(dto: RegisterTenantDto) {
    const { tenant, property } =
      await this.tenantsService.createTenantWithDefaultProperty({
        tenantName: dto.tenantName,
        subdomain: dto.subdomain,
        baseCurrency: dto.baseCurrency,
      });

    const roles = await this.rolesService.seedSystemRolesForTenant(tenant.id);
    const ownerRole = roles.find((r) => r.systemKey === SystemRoleKey.OWNER)!;

    const owner = await this.usersService.createUser({
      tenantId: tenant.id,
      email: dto.ownerEmail,
      password: dto.ownerPassword,
      fullName: dto.ownerFullName,
    });

    await this.rolesService.assignRoleToUser(
      tenant.id,
      owner.id,
      ownerRole.id,
      null,
    );

    // Namunaviy (demo) ma'lumotlar — foydalanuvchi bo'sh tizim o'rniga jonli
    // misol bilan tanishishi uchun. Bu YORDAMCHI qadam: agar biror sababdan
    // (masalan kutilmagan xatolik) muvaffaqiyatsiz bo'lsa, butun ro'yxatdan
    // o'tish oqimini BUZMASLIGI kerak — shuning uchun xato faqat log qilinadi.
    try {
      await this.sampleDataService.seedForTenant({
        tenantId: tenant.id,
        propertyId: property.id,
        ownerUserId: owner.id,
        currency: tenant.baseCurrency,
      });
      // `tenant` obyekti shu funksiya boshida yaratilgan — seed tranzaksiyasi
      // `has_sample_data`ni DB'da true qilib qo'ydi, lekin shu xotiradagi
      // nusxani avtomatik yangilamaydi. Javobda to'g'ri qiymat qaytishi uchun
      // qo'lda yangilaymiz.
      tenant.hasSampleData = true;
    } catch (err) {
      this.logger.error(
        `Namunaviy ma'lumotlarni yaratishda xatolik (tenant ${tenant.id}): ${err instanceof Error ? err.message : err}`,
      );
    }

    const token = this.issueToken({
      sub: owner.id,
      tenantId: tenant.id,
      isPlatformAdmin: false,
    });

    return {
      tenant,
      property,
      user: this.publicUser(owner, tenant.subdomain, tenant.hasSampleData),
      ...token,
    };
  }

  async login(dto: LoginDto) {
    let tenant: Tenant | null = null;

    if (dto.subdomain) {
      tenant = await this.tenantsService.findBySubdomain(dto.subdomain);
      if (!tenant)
        throw new UnauthorizedException('Mehmonxona (subdomain) topilmadi');
    }

    const user = await this.usersService.findByEmailAndTenant(
      dto.email,
      tenant?.id ?? null,
    );
    if (!user) throw new UnauthorizedException("Email yoki parol noto'g'ri");

    const valid = await this.usersService.validatePassword(user, dto.password);
    if (!valid) throw new UnauthorizedException("Email yoki parol noto'g'ri");

    // Booking Engine (jonli bron widget'i) havolasini frontend'da ko'rsatish
    // uchun — subdomain login paytida berilmagan bo'lsa ham, foydalanuvchining
    // o'z tenant'i orqali qidiriladi.
    if (!tenant && user.tenantId) {
      tenant = await this.tenantsService.findById(user.tenantId);
    }

    const token = this.issueToken({
      sub: user.id,
      tenantId: user.tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
    });

    return {
      user: this.publicUser(user, tenant?.subdomain ?? null, tenant?.hasSampleData ?? false),
      ...token,
    };
  }

  private issueToken(payload: JwtPayload) {
    return { accessToken: this.jwtService.sign(payload) };
  }

  private publicUser(
    user: {
      id: string;
      email: string;
      fullName: string;
      tenantId: string | null;
      isPlatformAdmin: boolean;
    },
    tenantSubdomain: string | null = null,
    hasSampleData = false,
  ) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      tenantSubdomain,
      hasSampleData,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }
}
