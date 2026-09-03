import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { SetSalaryDto } from './dto/set-salary.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';

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
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ) {
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

  // Interim parol tiklash: "Parolni unutdingizmi?" bosilganda Login sahifasi
  // xodimni administratorga murojaat qilishga yo'naltiradi (email orqali
  // o'z-o'zini xizmat ko'rsatish hali yo'q) — administrator shu yerdan yangi
  // parol o'rnatadi.
  @Patch(':id/reset-password')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.EDIT)
  async resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetPassword(user.tenantId!, id, dto.newPassword);
    return { success: true };
  }

  @Patch(':id/status')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.EDIT)
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    if (id === user.userId) {
      throw new ForbiddenException(
        "O'zingizning holatingizni o'zgartira olmaysiz",
      );
    }
    const updated = await this.usersService.updateStatus(
      user.tenantId!,
      id,
      dto.status,
    );
    return { id: updated.id, status: updated.status };
  }

  // Payroll (2026-09): ataylab ALOHIDA, PAYROLL:VIEW/EDIT bilan himoyalangan
  // endpoint'lar — maosh USERS_ROLES:VIEW (yuqoridagi `list()`) javobiga
  // QO'SHILMAYDI, chunki kelajakda kimdir USERS_ROLES:view'ga ega bo'lib,
  // PAYROLL:view'ga ega bo'lmasligi mumkin (custom rol) — shu holatda ham
  // hamkasblarining maoshi oshkor bo'lib qolmasligi kerak.
  @Get(':id/salary')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  getSalary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.getSalary(user.tenantId!, id);
  }

  @Patch(':id/salary')
  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.EDIT)
  async setSalary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetSalaryDto,
  ) {
    const updated = await this.usersService.setSalary(
      user.tenantId!,
      id,
      dto.salaryType,
      dto.salaryAmount,
    );
    return {
      id: updated.id,
      salaryType: updated.salaryType,
      salaryAmount: updated.salaryAmount,
    };
  }
}
