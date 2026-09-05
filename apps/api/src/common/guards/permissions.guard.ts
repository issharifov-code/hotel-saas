import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/require-permission.decorator';
import { RolesService } from '../../modules/roles/roles.service';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

// JwtAuthGuard'dan KEYIN ishlaydi (request.user allaqachon mavjud bo'lishi kerak).
// @RequirePermission bilan belgilanmagan route'lar avtomatik ruxsat beriladi (faqat login talab qilinadi).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return false;

    // Platforma super-admin barcha tenant ruxsatlarini chetlab o'tadi
    // (u tenant ma'lumotlariga umuman kirmaydi, faqat Tenant Management API'laridan foydalanadi).
    if (user.isPlatformAdmin) return true;

    if (!user.tenantId) {
      throw new ForbiddenException(
        "Foydalanuvchi hech qanday tenant'ga bog'lanmagan",
      );
    }

    // 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Ilgari bu yerda
    // `|| request.query?.propertyId` ham bor edi. U 2026-09-05 da
    // `getEffectivePermissions` ichida yopilgan teshikni QAYTA OCHARDI:
    // tenant darajasidagi yo'llarda (/users, /roles, /guests ...) URL'da
    // `propertyId` parametri yo'q, demak qaysi rol hisobga olinishini
    // MIJOZ yuborgan query string hal qilardi. Faqat bitta filialga
    // biriktirilgan xodim `?propertyId=<o'z filiali>` qo'shib, o'sha rolni
    // tenant darajasidagi amalga ishlatib yuborardi — masalan
    // `PATCH /users/<ega>/salary?propertyId=<filial>`.
    //
    // `ValidationPipe` bu yerda yordam bermaydi: u faqat DTO'ga bog'langan
    // query'ni tekshiradi, bu yo'llar esa query DTO bog'lamaydi.
    //
    // Endi mulk konteksti FAQAT marshrut parametridan olinadi — ya'ni uni
    // marshrutning o'zi belgilaydi, mijoz emas.
    const propertyId: string | undefined = request.params?.propertyId as
      | string
      | undefined;

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
