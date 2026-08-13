import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  // Bu yerning natijasi request.user'ga yoziladi (@CurrentUser() shundan o'qiydi).
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      isPlatformAdmin: payload.isPlatformAdmin,
    };
  }
}
