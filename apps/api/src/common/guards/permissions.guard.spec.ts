import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    // 🔴 2026-09-05 auditi (M12): guard endi `:propertyId` ning joriy
    // tenantga tegishliligini ham tekshiradi. Bu yerda tekshiruv
    // o'tadigan qilib mock qilinadi; qoidaning O'ZI roles.service.spec.ts
    // da sinaladi.
    const assertPropertyBelongsToTenant = jest
      .fn()
      .mockResolvedValue(undefined);
    const guard = new PermissionsGuard(reflector, {
      getEffectivePermissions,
      assertPropertyBelongsToTenant,
    } as never);
    return { guard, getEffectivePermissions, assertPropertyBelongsToTenant };
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

// 🔴 XAVFSIZLIK AUDITI (2026-09-05, M12). Marshrutdagi `:propertyId`
// hech qayerda joriy tenantga tegishliligi bo'yicha tekshirilmasdi —
// `POST /properties/<begona-id>/warehouses` 201 qaytarib, hujumchining
// o'z tenantida begona `property_id` ga havola qiluvchi qator yaratardi.
// Guard endi shu chokepoint.
describe('PermissionsGuard — mulk tenantga tegishliligi', () => {
  class TestController {}
  function testHandler() {}

  function ctx(params: Record<string, string>, user: unknown = {
    userId: 'u1',
    tenantId: 't1',
    isPlatformAdmin: false,
  }): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user, params, query: {} }) }),
      getHandler: () => testHandler,
      getClass: () => TestController,
    } as unknown as ExecutionContext;
  }

  function build(required: unknown, assertImpl: jest.Mock) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new PermissionsGuard(reflector, {
      getEffectivePermissions: jest
        .fn()
        .mockResolvedValue(new Set(['users_roles:edit'])),
      assertPropertyBelongsToTenant: assertImpl,
    } as never);
  }

  it("begona mulk uchun tekshiruv chaqiriladi va xato yuqoriga o'tadi", async () => {
    const assertFn = jest
      .fn()
      .mockRejectedValue(new NotFoundException('Mulk topilmadi'));
    const guard = build(
      { module: PermissionModule.USERS_ROLES, action: PermissionAction.EDIT },
      assertFn,
    );
    await expect(guard.canActivate(ctx({ propertyId: 'begona' }))).rejects.toThrow(
      NotFoundException,
    );
    expect(assertFn).toHaveBeenCalledWith('t1', 'begona');
  });

  // ATAYLAB: mulk chegarasi @RequirePermission dan MUSTAQIL bo'lishi kerak,
  // aks holda dekorator qo'yilmagan marshrut ochiq qolardi.
  it('@RequirePermission yo\'q marshrutda ham tekshiriladi', async () => {
    const assertFn = jest
      .fn()
      .mockRejectedValue(new NotFoundException('Mulk topilmadi'));
    const guard = build(undefined, assertFn);
    await expect(guard.canActivate(ctx({ propertyId: 'begona' }))).rejects.toThrow(
      NotFoundException,
    );
  });

  it("propertyId bo'lmagan marshrutda tekshiruv chaqirilmaydi", async () => {
    const assertFn = jest.fn();
    const guard = build(undefined, assertFn);
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
    expect(assertFn).not.toHaveBeenCalled();
  });
});
