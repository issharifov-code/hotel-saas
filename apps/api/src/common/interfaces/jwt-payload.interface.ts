export interface JwtPayload {
  sub: string; // userId
  tenantId: string | null;
  isPlatformAdmin: boolean;
}

// req.user shu shaklda bo'ladi (JwtStrategy.validate natijasi).
export interface AuthenticatedUser {
  userId: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
}
