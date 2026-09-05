import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionAction, PermissionModule } from '../enums/permission.enum';

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Guard mulk kontekstini ilgari
// `request.params.propertyId || request.query.propertyId` dan olardi.
// Tenant darajasidagi yo'llarda (/users, /roles, /guests ...) marshrutda
// `propertyId` parametri yo'q, demak qaysi rol hisobga olinishini MIJOZ
// yuborgan query string hal qilardi: bitta filialga biriktirilgan xodim
// `?propertyId=<o'z filiali>` qo'shib, o'sha rolni butun tenant bo'ylab
// ishlatib yuborardi.
describe('PermissionsGuard — mulk konteksti manbasi', () => {
  const required = {
    module: PermissionModule.USERS_ROLES,
    action: PermissionAction.EDIT,
  };

  function createContext(
    params: Record<string, string>,
    query: Record<string, string>,
  ): ExecutionContext {
    const request = {
      user: { userId: 'u1', tenantId: 't1', isPlatformAdmin: false },
      params,
      query,
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  function createGuard() {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    // Faqat `propertyId === 'p1'` berilgandagina ruxsat qaytaradi — ya'ni
    // "mulkka biriktirilgan rol" holatini taqlid qiladi.
    const getEffectivePermissions = jest
      .fn()
      .mockImplementation((_t: string, _u: string, propertyId?: string) =>
        Promise.resolve(
          propertyId === 'p1'
            ? new Set([`${required.module}:${required.action}`])
            : new Set<string>(),
        ),
      );
    const guard = new PermissionsGuard(reflector, {
      getEffectivePermissions,
    } as never);
    return { guard, getEffectivePermissions };
  }

  it("query string'dagi propertyId ruxsat BERMAYDI (escalation to'sildi)", async () => {
    const { guard } = createGuard();
    await expect(
      guard.canActivate(createContext({}, { propertyId: 'p1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it("guard'ga query'dagi qiymat umuman uzatilmaydi", async () => {
    const { guard, getEffectivePermissions } = createGuard();
    await expect(
      guard.canActivate(createContext({}, { propertyId: 'p1' })),
    ).rejects.toThrow(ForbiddenException);
    expect(getEffectivePermissions).toHaveBeenCalledWith('t1', 'u1', undefined);
  });

  it("marshrut parametridagi propertyId ishlaydi (haqiqiy mulk yo'li)", async () => {
    const { guard, getEffectivePermissions } = createGuard();
    await expect(
      guard.canActivate(createContext({ propertyId: 'p1' }, {})),
    ).resolves.toBe(true);
    expect(getEffectivePermissions).toHaveBeenCalledWith('t1', 'u1', 'p1');
  });

  it("marshrut parametri boshqa mulkniki bo'lsa rad etadi", async () => {
    const { guard } = createGuard();
    await expect(
      guard.canActivate(createContext({ propertyId: 'p2' }, {})),
    ).rejects.toThrow(ForbiddenException);
  });
});
