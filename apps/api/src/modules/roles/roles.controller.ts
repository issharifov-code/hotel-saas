import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
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

  // Barcha mavjud ruxsatlar ro'yxati (rol yaratish formasi uchun) — o'qish uchun maxsus ruxsat talab qilinmaydi.
  @Get('permissions')
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
      dto.name,
      dto.permissionIds,
    );
  }

  @Patch('roles/:id/permissions')
  @RequirePermission(PermissionModule.USERS_ROLES, PermissionAction.EDIT)
  updateRolePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') roleId: string,
    @Body('permissionIds') permissionIds: string[],
  ) {
    return this.rolesService.updateRolePermissions(
      user.tenantId!,
      roleId,
      permissionIds,
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
