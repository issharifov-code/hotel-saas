import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PermissionAction, PermissionModule } from '../../common/enums/permission.enum';

// Xodim (tenant foydalanuvchisi) yaratish/ro'yxatini ko'rish — Role Management modulining
// bir qismi: avval foydalanuvchi yaratiladi, keyin unga rol biriktiriladi (POST /user-roles).
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listByTenant(user.tenantId!).then((users) =>
      users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        status: u.status,
        createdAt: u.createdAt,
      })),
    );
  }

  @Post()
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.CREATE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    const created = await this.usersService.createUser({
      tenantId: user.tenantId!,
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
    });
    return {
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      status: created.status,
    };
  }
}
