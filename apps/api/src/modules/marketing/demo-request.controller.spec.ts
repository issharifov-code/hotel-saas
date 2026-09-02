import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DemoRequestController } from './demo-request.controller';
import { MarketingService } from './marketing.service';

// Login sahifasidagi "Demo so'rash" formasi — TO'LIQ OCHIQ (guard yo'q),
// xuddi /auth/register-tenant kabi. Bu spec faqat guardsiz ishlashini va
// tanadagi maydonlarning servisga to'g'ri uzatilishini tasdiqlaydi.
describe('DemoRequestController (HTTP)', () => {
  let app: INestApplication;
  let marketingService: { createDemoRequest: jest.Mock };

  beforeAll(async () => {
    marketingService = {
      createDemoRequest: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DemoRequestController],
      providers: [{ provide: MarketingService, useValue: marketingService }],
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

  describe('POST /marketing/demo-requests', () => {
    it("Authorization header'siz (guest sifatida) so'rov yuboriladi", async () => {
      marketingService.createDemoRequest.mockResolvedValue({ id: 'dr-new' });

      await request(app.getHttpServer())
        .post('/marketing/demo-requests')
        .send({
          fullName: 'Ali Valiyev',
          phone: '+998901234567',
          email: 'ali@example.com',
        })
        .expect(201);

      expect(marketingService.createDemoRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Ali Valiyev',
          phone: '+998901234567',
          email: 'ali@example.com',
        }),
      );
    });

    it("noto'g'ri (masalan yasama) Authorization header bilan ham 401/403 QAYTARMAYDI, chunki guard yo'q", async () => {
      marketingService.createDemoRequest.mockResolvedValue({ id: 'dr-new' });

      await request(app.getHttpServer())
        .post('/marketing/demo-requests')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({ fullName: 'Ali Valiyev', phone: '+998901234567' })
        .expect(201);

      expect(marketingService.createDemoRequest).toHaveBeenCalledTimes(1);
    });
  });
});
