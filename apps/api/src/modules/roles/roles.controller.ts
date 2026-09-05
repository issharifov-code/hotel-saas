import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  PermissionAction,
  PermissionModule,
} from '../../common/enums/permission.enum';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  // Barcha mavjud ruxsatlar ro'yxati (rol yaratish formasi uchun).
  //
  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Low). Ilgari bu yerda hech qanday
  // ruxsat talab qilinmasdi, ya'ni istalgan tizimga kirgan xodim (masalan
  // POS ofitsianti) barcha 65 ta ruxsat UUID'sini olardi — aynan
  // `POST /roles` uchun kerak bo'ladigan `permissionIds` ro'yxatini.
  // O'z-o'zidan zarar emas, lekin rol eskalatsiyasining birinchi qadami
  // edi. Endi rol boshqarish ruxsati talab qilinadi.
  @Get('permissions')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.VIEW)
  listPermissions() {
    return this.permissionsService.findAll();
  }

  @Get('roles')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.VIEW)
  listRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.listRolesForTenant(user.tenantId!);
  }

  @Post('roles')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.CREATE)
  createRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.createCustomRole(
      user.tenantId!,
      user.userId,
      dto.name,
      dto.permissionIds,
    );
  }

  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Ilgari bu yerda
  // `@Body('permissionIds') permissionIds: string[]` — xom primitiv edi.
  // Global `ValidationPipe`ning `whitelist`/`forbidNonWhitelisted`
  // sozlamalari FAQAT klass-DTO'ga ta'sir qiladi, ya'ni bu yo'l istalgan
  // JSON shaklini qabul qilardi: `null` yuborilsa 500, string yuborilsa
  // `.includes()` massiv emas SATR ustida ishlab, kutilmagan ruxsatlarni
  // mos deb topardi.
  @Patch('roles/:id/permissions')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.EDIT)
  updateRolePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updateRolePermissions(
      user.tenantId!,
      user.userId,
      roleId,
      dto.permissionIds,
    );
  }

  @Get('user-roles')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.VIEW)
  listUserRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.listUserRoleAssignments(user.tenantId!);
  }

  @Post('user-roles')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.EDIT)
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rolesService.assignRoleToUser(
      user.tenantId!,
      dto.userId,
      dto.roleId,
      dto.propertyId ?? null,
      // Chaqiruvchi — eskalatsiya tekshiruvlari uchun (o'ziga biriktirish
      // va o'zida yo'q ruxsatni berish taqiqlanadi).
      user.userId,
    );
  }

  @Delete('user-roles/:userId/:roleId')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.EDIT)
  removeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.removeRoleFromUser(user.tenantId!, userId, roleId);
  }

  @Get('me/permissions')
  myPermissions(@CurrentUser() user: AuthenticatedUser) {
    if (!user.tenantId) return [];
    return this.rolesService
      .getEffectivePermissions(user.tenantId, user.userId)
      .then((set) => Array.from(set));
  }
}
