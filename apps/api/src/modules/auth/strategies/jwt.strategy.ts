import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  JwtPayload,
  AuthenticatedUser,
} from '../../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  // Bu yerning natijasi request.user'ga yoziladi (@CurrentUser() shundan o'qiydi).
  //
  // 🔴 2026-09-05 (audit): avval bu metod FAQAT imzoni tekshirardi va
  // to'g'ridan-to'g'ri payload'ni qaytarardi — ya'ni bloklangan xodimning
  // tokeni muddati tugagunicha (8 soat) ishlayverardi. Endi har so'rovda
  // bazadagi holat bilan solishtiriladi:
  //
  //   * foydalanuvchi hali mavjudmi;
  //   * statusi ACTIVE'mi (bloklangan bo'lsa — darhol 401);
  //   * tokendagi `tv` bazadagi `token_version` bilan mos keladimi
  //     (parol almashtirilgan yoki status o'zgargan bo'lsa — mos kelmaydi).
  //
  // Narxi: `getAuthService` 15 soniyalik kesh ortida, ya'ni bitta sahifa
  // ochilishidagi 5-10 parallel so'rov bitta SELECT'ga yig'iladi.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const state = await this.usersService.getAuthState(payload.sub);
    if (!state) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }
    if (state.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        "Hisobingiz faol emas — mehmonxona administratoriga murojaat qiling",
      );
    }
    // `?? 0` — shu o'zgarish joriy qilingan paytda amal qilayotgan eski
    // tokenlarda `tv` maydoni yo'q. Ular `token_version = 0` bilan mos
    // keladi, ya'ni deploy hech kimni tizimdan chiqarmaydi. Bekor qilish
    // birinchi marta ishlaganda hisoblagich 1 ga chiqadi va eski tokenlar
    // ham o'sha zahoti kuchini yo'qotadi.
    if ((payload.tv ?? 0) !== state.tokenVersion) {
      throw new UnauthorizedException(
        "Sessiya muddati tugagan — qaytadan kiring",
      );
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      // 🔴 XAVFSIZLIK AUDITI (2026-09-05, Medium). Ilgari bu qiymat
      // TOKENDAN olinardi. Token 8 soat amal qiladi, ya'ni platforma
      // admin huquqi olib tashlangan bo'lsa ham shuncha vaqt kuchda
      // qolardi. Endi u ham `getAuthState` orqali BAZADAN keladi —
      // ya'ni huquq bekor qilinishi bilan (kesh muddati ichida) kuchsiz
      // bo'ladi, xuddi status va `token_version` kabi.
      isPlatformAdmin: state.isPlatformAdmin,
    };
  }
}
