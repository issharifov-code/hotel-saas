import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('register-tenant')
  registerTenant(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const fullUser = await this.usersService.findById(user.userId);
    // Booking Engine (jonli bron widget'i) havolasini xodimga ko'rsatish
    // uchun — frontend `/book/:subdomain` sahifasiga havola quradi.
    const tenant = fullUser?.tenantId
      ? await this.tenantsService.findById(fullUser.tenantId)
      : null;
    return {
      id: fullUser?.id,
      email: fullUser?.email,
      fullName: fullUser?.fullName,
      tenantId: fullUser?.tenantId,
      tenantSubdomain: tenant?.subdomain ?? null,
      hasSampleData: tenant?.hasSampleData ?? false,
      isPlatformAdmin: fullUser?.isPlatformAdmin,
    };
  }
}
