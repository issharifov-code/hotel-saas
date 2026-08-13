import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

// Faqat platforma super-admin foydalanuvchilari uchun (Tenant Management API'lari).
// JwtAuthGuard'dan keyin ishlatiladi.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Faqat platforma administratori uchun');
    }
    return true;
  }
}
