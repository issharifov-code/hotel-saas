import { Request } from 'express';
import { AuthenticatedUser } from './jwt-payload.interface';

// `ExecutionContext.switchToHttp().getRequest()` standart holatda `any`
// qaytaradi (Nest'ning umumiy `getRequest<T = any>()` imzosi sababli) —
// bu esa `request.user`/`request.params`/`request.query`ga har qanday
// murojaatni `@typescript-eslint/no-unsafe-member-access` xatosiga olib
// keladi. Bu — auditda Medium darajali kod-sifat topilmasi sifatida qayd
// etilgan, 4 ta xavfsizlik-muhim faylda (current-user.decorator.ts,
// permissions.guard.ts, platform-admin.guard.ts, rls-transaction.
// interceptor.ts) takrorlangan naqsh edi. Ushbu umumiy tip shu 4 faylda
// `getRequest<RequestWithUser>()` sifatida ishlatilib, muammoni bitta
// joyda hal qiladi.
export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
