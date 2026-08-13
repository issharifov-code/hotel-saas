import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';
import { RolesService } from '../../modules/roles/roles.service';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

// JwtAuthGuard'dan KEYIN ishlaydi (request.user allaqachon mavjud bo'lishi kerak).
// @RequirePermission bilan belgilanmagan route'lar avtomatik ruxsat beriladi (faqat login talab qilinadi).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    if (!user) return false;

    // Platforma super-admin barcha tenant ruxsatlarini chetlab o'tadi
    // (u tenant ma'lumotlariga umuman kirmaydi, faqat Tenant Management API'laridan foydalanadi).
    if (user.isPlatformAdmin) return true;

    if (!user.tenantId) {
      throw new ForbiddenException("Foydalanuvchi hech qanday tenant'ga bog'lanmagan");
    }

    const propertyId: string | undefined = request.params?.propertyId || request.query?.propertyId;

    const permissions = await this.rolesService.getEffectivePermissions(
      user.tenantId,
      user.userId,
      propertyId,
    );

    const key = `${required.module}:${required.action}`;
    if (!permissions.has(key)) {
      throw new ForbiddenException(
        `Ushbu amal uchun ruxsat yo'q: ${required.module}.${required.action}`,
      );
    }
    return true;
  }
}
