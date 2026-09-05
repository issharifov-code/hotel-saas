export interface JwtPayload {
  sub: string; // userId
  tenantId: string | null;
  isPlatformAdmin: boolean;

  // Token bekor qilish hisoblagichi (`users.token_version`, 2026-09-05).
  // Har so'rovda bazadagi qiymat bilan solishtiriladi — mos kelmasa token
  // yaroqsiz (JwtStrategy).
  //
  // IXTIYORIY: bu maydon joriy qilingan paytda amal qilayotgan eski
  // tokenlarda u yo'q. Strategiya yo'qligini 0 deb hisoblaydi, ya'ni
  // deploy hech kimni tizimdan chiqarib yubormaydi. Yangi tokenlarning
  // hammasida `tv` bor.
  tv?: number;
}

// req.user shu shaklda bo'ladi (JwtStrategy.validate natijasi).
export interface AuthenticatedUser {
  userId: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
}
