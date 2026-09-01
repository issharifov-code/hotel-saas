import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PublicBookingController } from './public-booking.controller';
import { PublicBookingService } from './public-booking.service';
import { PublicTenantGuard } from './public-tenant.guard';
import { TenantsService } from '../tenants/tenants.service';
import { TenantStatus } from '../tenants/entities/tenant.entity';

// Bu controller AUTENTIFIKATSIYASIZ — JwtAuthGuard/PermissionsGuard emas,
// faqat PublicTenantGuard ishlatiladi (URL'dagi :subdomain orqali tenant
// aniqlanadi). Eng muhim tekshiruv: SUSPENDED/CANCELLED tenant'lar uchun
// widget yopiq bo'lishi shart (to'lov qilinmagan mehmonxona uchun jonli
// bron qabul qilinmasligi kerak) — bu faqat HTTP darajasida, guard bilan
// birga sinalganda haqiqiy ma'noga ega.
describe('PublicBookingController (HTTP)', () => {
  let app: INestApplication;
  let publicBookingService: {
    listProperties: jest.Mock;
    getAvailability: jest.Mock;
    createBooking: jest.Mock;
  };
  let tenantsService: { findBySubdomain: jest.Mock };

  beforeAll(async () => {
    publicBookingService = {
      listProperties: jest.fn(),
      getAvailability: jest.fn(),
      createBooking: jest.fn(),
    };
    tenantsService = { findBySubdomain: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [PublicBookingController],
      providers: [
        { provide: PublicBookingService, useValue: publicBookingService },
        { provide: TenantsService, useValue: tenantsService },
        PublicTenantGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/:subdomain/properties', () => {
    it("mavjud bo'lmagan subdomain uchun 404 qaytaradi (mehmonga ichki holat oshkor qilinmaydi)", async () => {
      tenantsService.findBySubdomain.mockResolvedValue(null);
      await request(app.getHttpServer())
        .get('/public/yoq-mehmonxona/properties')
        .expect(404);
      expect(publicBookingService.listProperties).not.toHaveBeenCalled();
    });

    it("SUSPENDED tenant uchun 404 qaytaradi (to'lov qilinmagan mehmonxona uchun widget yopiq)", async () => {
      tenantsService.findBySubdomain.mockResolvedValue({
        id: 't-suspended',
        subdomain: 'muddati-otgan',
        status: TenantStatus.SUSPENDED,
      });
      await request(app.getHttpServer())
        .get('/public/muddati-otgan/properties')
        .expect(404);
      expect(publicBookingService.listProperties).not.toHaveBeenCalled();
    });

    it('CANCELLED tenant uchun 404 qaytaradi', async () => {
      tenantsService.findBySubdomain.mockResolvedValue({
        id: 't-cancelled',
        subdomain: 'bekor-qilingan',
        status: TenantStatus.CANCELLED,
      });
      await request(app.getHttpServer())
        .get('/public/bekor-qilingan/properties')
        .expect(404);
    });

    it('TRIAL tenant uchun ishlaydi (faqat ACTIVE talab qilinmaydi)', async () => {
      tenantsService.findBySubdomain.mockResolvedValue({
        id: 't-trial',
        subdomain: 'yangi-mehmonxona',
        status: TenantStatus.TRIAL,
      });
      publicBookingService.listProperties.mockResolvedValue([
        { id: 'p1', name: 'Demo Property', address: null, currency: 'UZS' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/public/yangi-mehmonxona/properties')
        .expect(200);

      expect(res.body).toHaveLength(1);
      // Guard URL'dagi subdomain orqali topgan tenant ID'ni servisga uzatishi shart.
      expect(publicBookingService.listProperties).toHaveBeenCalledWith(
        't-trial',
      );
    });

    it('ACTIVE tenant uchun ishlaydi', async () => {
      tenantsService.findBySubdomain.mockResolvedValue({
        id: 't-active',
        subdomain: 'ishlayotgan',
        status: TenantStatus.ACTIVE,
      });
      publicBookingService.listProperties.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/ishlayotgan/properties')
        .expect(200);
      expect(publicBookingService.listProperties).toHaveBeenCalledWith(
        't-active',
      );
    });
  });

  describe('GET /public/:subdomain/properties/:propertyId/availability', () => {
    it("bo'sh xonalar ro'yxatini shu subdomain'ning tenant ID'si bilan qaytaradi", async () => {
      tenantsService.findBySubdomain.mockResolvedValue({
        id: 't-active',
        subdomain: 'ishlayotgan',
        status: TenantStatus.ACTIVE,
      });
      publicBookingService.getAvailability.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/ishlayotgan/properties/p1/availability')
        .query({ checkIn: '2026-10-01', checkOut: '2026-10-03' })
        .expect(200);

      expect(publicBookingService.getAvailability).toHaveBeenCalledWith(
        't-active',
        'p1',
        '2026-10-01',
        '2026-10-03',
      );
    });
  });

  describe('POST /public/:subdomain/properties/:propertyId/bookings', () => {
    it('tenant topilmasa (404) bron yaratishga umuman urinmaydi', async () => {
      tenantsService.findBySubdomain.mockResolvedValue(null);
      await request(app.getHttpServer())
        .post('/public/yoq/properties/p1/bookings')
        .send({
          roomTypeId: '11111111-1111-1111-1111-111111111111',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
          guestFullName: 'Aziz Karimov',
          guestPhone: '+998901234567',
        })
        .expect(404);
      expect(publicBookingService.createBooking).not.toHaveBeenCalled();
    });

    it("to'g'ri subdomain bilan bronni shu tenant ID'sida yaratadi", async () => {
      tenantsService.findBySubdomain.mockResolvedValue({
        id: 't-active',
        subdomain: 'ishlayotgan',
        status: TenantStatus.ACTIVE,
      });
      publicBookingService.createBooking.mockResolvedValue({
        id: 'booking-1',
        checkIn: '2026-10-01',
        checkOut: '2026-10-03',
        totalAmount: '400000.00',
        currency: 'UZS',
        status: 'pending',
      });

      const res = await request(app.getHttpServer())
        .post('/public/ishlayotgan/properties/p1/bookings')
        .send({
          roomTypeId: '11111111-1111-1111-1111-111111111111',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
          guestFullName: 'Aziz Karimov',
          guestPhone: '+998901234567',
        })
        .expect(201);

      expect(res.body).toMatchObject({ id: 'booking-1', status: 'pending' });
      expect(publicBookingService.createBooking).toHaveBeenCalledWith(
        't-active',
        'p1',
        expect.objectContaining({ guestFullName: 'Aziz Karimov' }),
      );
    });
  });
});
