import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { TenantStatus, Tenant } from '../tenants/entities/tenant.entity';

interface PublicBookingRequest {
  params: { subdomain?: string };
  user?: { userId: string; tenantId: string; isPlatformAdmin: boolean };
  publicTenant?: Tenant;
}

// Ochiq (autentifikatsiyasiz) bron widget'i uchun: URL'dagi `subdomain`
// parametri orqali tenant'ni topadi va so'rovga sun'iy `request.user`
// (faqat tenantId bilan, JwtAuthGuard bergani bilan bir xil shaklda)
// biriktiradi — shu orqali RlsContextService'ning mavjud mexanizmi
// (Guard'lardan KEYIN, RLS-repository so'rovlaridan OLDIN `app.tenant_id`ni
// o'rnatadi) hech qanday o'zgarishsiz ishlab turadi, xuddi JWT bilan
// autentifikatsiya qilingan so'rovlardagi kabi. PermissionsGuard bu yerda
// ATAYLAB ishlatilmaydi — bu so'rov aniq bir xodimni emas, tenant'ning o'zini
// (uning ochiq bron xizmatini) ifodalaydi.
@Injectable()
export class PublicTenantGuard implements CanActivate {
  constructor(private readonly tenantsService: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicBookingRequest>();
    const subdomain = request.params?.subdomain;
    if (!subdomain) throw new NotFoundException('Mehmonxona topilmadi');

    const tenant = await this.tenantsService.findBySubdomain(subdomain);
    if (!tenant) throw new NotFoundException('Mehmonxona topilmadi');

    // Faqat TRIAL/ACTIVE tenant'lar ochiq bron qabul qiladi — SUSPENDED
    // (to'lov qilinmagan) yoki CANCELLED tenant'lar uchun widget yopiq
    // (xuddi login qilib bo'lmaydigan holat kabi, lekin xodim emas, mehmon
    // uchun neytral "topilmadi" xabari bilan — ichki holat oshkor qilinmaydi).
    if (![TenantStatus.TRIAL, TenantStatus.ACTIVE].includes(tenant.status)) {
      throw new NotFoundException(
        'Mehmonxona hozircha jonli bron qabul qilmayapti',
      );
    }

    request.user = {
      userId: 'public-widget',
      tenantId: tenant.id,
      isPlatformAdmin: false,
    };
    request.publicTenant = tenant;
    return true;
  }
}
