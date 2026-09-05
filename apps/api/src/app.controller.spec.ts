import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let query: jest.Mock;

  async function build(queryImpl: jest.Mock) {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getDataSourceToken(), useValue: { query: queryImpl } },
      ],
    }).compile();
    return app.get<AppController>(AppController);
  }

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([{ timestamp: '1789500000000' }]);
    appController = await build(query);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  // 🔴 Bu endpoint deploy holatini tekshirish uchun (2026-09-05). Uning
  // qiymati aynan shundaki, u TASHQARIDAN, autentifikatsiyasiz javob
  // beradi — shuning uchun qaytadigan maydonlar ham sinovdan o'tadi.
  describe('GET /version', () => {
    it("kommit, ishga tushish vaqti va sxema versiyasini qaytaradi", async () => {
      process.env.RENDER_GIT_COMMIT = 'abc123def';
      const res = await appController.getVersion();

      expect(res.commit).toBe('abc123def');
      expect(res.schemaVersion).toBe(1789500000000);
      expect(typeof res.uptimeSeconds).toBe('number');
      expect(new Date(res.startedAt).toString()).not.toBe('Invalid Date');

      delete process.env.RENDER_GIT_COMMIT;
    });

    it("kommit muhit o'zgaruvchisi bo'lmasa 'unknown' qaytaradi", async () => {
      delete process.env.RENDER_GIT_COMMIT;
      delete process.env.GIT_COMMIT;
      delete process.env.SOURCE_VERSION;

      const res = await appController.getVersion();
      expect(res.commit).toBe('unknown');
    });

    it('sxema versiyasini eng yangi migratsiyadan oladi', async () => {
      await appController.getVersion();
      const sql = query.mock.calls[0][0] as string;
      expect(sql).toMatch(/ORDER BY "timestamp" DESC/);
      expect(sql).toMatch(/LIMIT 1/);
    });

    // Bu endpoint aynan "nima bo'lyapti?" deb qaraladigan joy — baza
    // javob bermayotgan paytda ham u 500 emas, javob qaytarishi kerak.
    it("baza javob bermasa ham 500 emas, schemaVersion=null qaytaradi", async () => {
      const failing = jest.fn().mockRejectedValue(new Error('connection refused'));
      const controller = await build(failing);

      const res = await controller.getVersion();
      expect(res.schemaVersion).toBeNull();
      expect(res.commit).toBeDefined();
    });

    it("migratsiyalar jadvali bo'sh bo'lsa null qaytaradi", async () => {
      const empty = jest.fn().mockResolvedValue([]);
      const controller = await build(empty);

      const res = await controller.getVersion();
      expect(res.schemaVersion).toBeNull();
    });
  });
});
