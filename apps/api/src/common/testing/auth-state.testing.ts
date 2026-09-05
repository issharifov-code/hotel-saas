import { UsersService } from '../../modules/users/users.service';
import { UserStatus } from '../../modules/users/entities/user.entity';

// `JwtStrategy` har so'rovda `UsersService.getAuthState()` ni chaqiradi —
// token bekor qilish tekshiruvi (2026-09-05, `users.token_version`).
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
};

export function authStateTestProvider() {
  return {
    provide: UsersService,
    useValue: {
      getAuthState: jest.fn().mockResolvedValue(ACTIVE_AUTH_STATE),
    },
  };
}
