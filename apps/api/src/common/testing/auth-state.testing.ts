import { UsersService } from '../../modules/users/users.service';
import { UserStatus } from '../../modules/users/entities/user.entity';

// `JwtStrategy` har so'rovda `UsersService.getAuthState()` ni chaqiradi —
// token bekor qilish tekshiruvi (2026-09-05, `users.token_version`) va
// platforma-admin bayrog'ini bazadan o'qish (2026-09-05 xavfsizlik auditi).
// Shu sababli guard/ruxsatlarni HTTP darajasida sinaydigan har bir
// controller spec'ida `UsersService` mavjud bo'lishi kerak.
//
// Bu yordamchi "foydalanuvchi mavjud, faol, hisoblagichi 0" holatini
// beradi — ya'ni tokendagi `tv` yo'q (yoki 0) bo'lsa o'tadi. Bekor
// qilishning O'ZI `users.service.spec.ts` va `jwt.strategy.spec.ts` da
// alohida sinaladi.
//
// Nima uchun yordamchi funksiya, har bir spec'da qo'lda mock emas:
// `JwtStrategy` kelajakda yana bir bog'liqlik olsa, o'ttizdan ortiq spec
// o'rniga faqat shu fayl o'zgaradi.
export const ACTIVE_AUTH_STATE = {
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
  isPlatformAdmin: false,
};

export const PLATFORM_ADMIN_AUTH_STATE = {
  ...ACTIVE_AUTH_STATE,
  isPlatformAdmin: true,
};

/**
 * `platformAdmins` — `isPlatformAdmin: true` qaytariladigan userId'lar.
 *
 * ATAYLAB aniq ro'yxat: `isPlatformAdmin` endi TOKENDAN emas, BAZADAN
 * o'qiladi (2026-09-05 auditi, Medium), shuning uchun platforma-admin
 * yo'llarini sinaydigan spec o'sha userId'ni bu yerda ko'rsatishi kerak.
 * Aks holda test tokeni admin desa ham, servis "admin emas" deb javob
 * beradi — bu aynan yangi, to'g'ri xatti-harakat.
 */
export function authStateTestProvider(
  options: { platformAdmins?: string[] } = {},
) {
  const platformAdmins = new Set(options.platformAdmins ?? []);
  return {
    provide: UsersService,
    useValue: {
      getAuthState: jest.fn((userId: string) =>
        Promise.resolve(
          platformAdmins.has(userId)
            ? PLATFORM_ADMIN_AUTH_STATE
            : ACTIVE_AUTH_STATE,
        ),
      ),
    },
  };
}
