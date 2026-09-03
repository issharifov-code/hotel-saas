import { SetMetadata } from '@nestjs/common';
import { PermissionAction, PermissionModule } from '../enums/permission.enum';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  module: PermissionModule;
  action: PermissionAction;
}

// Controller metodini himoyalash uchun: @RequirePermission(PermissionModule.WAREHOUSE, PermissionAction.EDIT)
export const RequirePermission = (
  module: PermissionModule,
  action: PermissionAction,
) =>
  SetMetadata<string, RequiredPermission>(PERMISSION_KEY, { module, action });
