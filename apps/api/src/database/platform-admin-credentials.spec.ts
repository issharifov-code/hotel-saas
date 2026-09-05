import {
  readPlatformAdminCredentials,
  MIN_ADMIN_PASSWORD_LENGTH,
} from './platform-admin-credentials';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, Critical). Seed Render'da HAR DEPLOY'da
// ishlaydi va ilgari `PLATFORM_ADMIN_*` o'rnatilmagan bo'lsa, repo'da turgan
// standart parol (`ChangeMe123!`) bilan platforma super-admin hisobini
// yaratardi. Bu testlar aynan shu qaytib kelmasligini qo'riqlaydi.
describe('readPlatformAdminCredentials', () => {
  const STRONG = 'juda-kuchli-parol-2026';

  it("production'da o'zgaruvchilar yo'q bo'lsa xato tashlaydi (standart parol yo'q)", () => {
    expect(() =>
      readPlatformAdminCredentials({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/majburiy/);
  });

  it("production'da faqat email berilsa ham xato tashlaydi", () => {
    expect(() =>
      readPlatformAdminCredentials({
        NODE_ENV: 'production',
        PLATFORM_ADMIN_EMAIL: 'a@b.uz',
      } as NodeJS.ProcessEnv),
    ).toThrow(/majburiy/);
  });

  it("dev muhitida o'zgaruvchilar yo'q bo'lsa null qaytaradi (admin yaratilmaydi)", () => {
    expect(
      readPlatformAdminCredentials({ NODE_ENV: 'development' } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it('sizib chiqqan eski standart parolni rad etadi', () => {
    expect(() =>
      readPlatformAdminCredentials({
        NODE_ENV: 'production',
        PLATFORM_ADMIN_EMAIL: 'a@b.uz',
        PLATFORM_ADMIN_PASSWORD: 'ChangeMe123!',
      } as NodeJS.ProcessEnv),
    ).toThrow(/eski standart parol/);
  });

  it('qisqa parolni rad etadi', () => {
    expect(() =>
      readPlatformAdminCredentials({
        NODE_ENV: 'production',
        PLATFORM_ADMIN_EMAIL: 'a@b.uz',
        PLATFORM_ADMIN_PASSWORD: 'x'.repeat(MIN_ADMIN_PASSWORD_LENGTH - 1),
      } as NodeJS.ProcessEnv),
    ).toThrow(new RegExp(String(MIN_ADMIN_PASSWORD_LENGTH)));
  });

  // `UsersService` emailni har doim kichik harfda saqlaydi va login ham
  // shunday qidiradi. Seed boshqacha saqlasa, yaratilgan hisobga hech
  // qachon kirib bo'lmasdi.
  it('emailni kichik harfga keltiradi va bo\'shliqni oladi', () => {
    const creds = readPlatformAdminCredentials({
      NODE_ENV: 'production',
      PLATFORM_ADMIN_EMAIL: '  Issharifov@Gmail.COM ',
      PLATFORM_ADMIN_PASSWORD: STRONG,
    } as NodeJS.ProcessEnv);
    expect(creds).toEqual({ email: 'issharifov@gmail.com', password: STRONG });
  });
});
