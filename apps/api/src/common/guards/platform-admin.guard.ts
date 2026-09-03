import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

// Faqat platforma super-admin foydalanuvchilari uchun (Tenant Management API'lari).
// JwtAuthGuard'dan keyin ishlatiladi.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Faqat platforma administratori uchun');
    }
    return true;
  }
}
