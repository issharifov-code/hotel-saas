import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../roles/roles.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { SystemRoleKey } from '../../common/enums/permission.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
  ) {}

  // Onboarding: yangi mehmonxona ro'yxatdan o'tkazish (6.1-bo'lim, self-service).
  // Tenant + default Property + 6 ta standart rol + Owner foydalanuvchi bitta oqimda yaratiladi.
  async registerTenant(dto: RegisterTenantDto) {
    const { tenant, property } = await this.tenantsService.createTenantWithDefaultProperty({
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

    await this.rolesService.assignRoleToUser(tenant.id, owner.id, ownerRole.id, null);

    const token = this.issueToken({
      sub: owner.id,
      tenantId: tenant.id,
      isPlatformAdmin: false,
    });

    return { tenant, property, user: this.publicUser(owner), ...token };
  }

  async login(dto: LoginDto) {
    let tenantId: string | null = null;

    if (dto.subdomain) {
      const tenant = await this.tenantsService.findBySubdomain(dto.subdomain);
      if (!tenant) throw new UnauthorizedException("Mehmonxona (subdomain) topilmadi");
      tenantId = tenant.id;
    }

    const user = await this.usersService.findByEmailAndTenant(dto.email, tenantId);
    if (!user) throw new UnauthorizedException("Email yoki parol noto'g'ri");

    const valid = await this.usersService.validatePassword(user, dto.password);
    if (!valid) throw new UnauthorizedException("Email yoki parol noto'g'ri");

    const token = this.issueToken({
      sub: user.id,
      tenantId: user.tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
    });

    return { user: this.publicUser(user), ...token };
  }

  private issueToken(payload: JwtPayload) {
    return { accessToken: this.jwtService.sign(payload) };
  }

  private publicUser(user: { id: string; email: string; fullName: string; tenantId: string | null; isPlatformAdmin: boolean }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }
}
