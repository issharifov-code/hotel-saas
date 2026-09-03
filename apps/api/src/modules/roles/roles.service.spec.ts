import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RolesService } from './roles.service';
import { SYSTEM_ROLE_DEFINITIONS } from '../../common/constants/role-permission-matrix';
import {
  PermissionAction,
  PermissionModule,
  SystemRoleKey,
} from '../../common/enums/permission.enum';

// RolesService (2026-08-24'dagi RLS kengaytmasidan keyin) haqiqiy injected
// repository'lar o'rniga `roleRepo.manager.transaction()` orqali o'z
// tranzaksiyasini ochadi va `manager.getRepository(Role/UserRole)` bilan
// yozadi/o'qiydi — SampleDataService test naqshiga o'xshab, xotirada
// ishlaydigan "fake manager" yasaymiz. Farqi: bu yerda `find`/`findOne`ning
// `relations` parametri (masalan UserRole -> role -> permissions) qo'lda
// taqlid qilinishi kerak, chunki haqiqiy DB join'i yo'q.
describe('RolesService', () => {
  function createFakeManager() {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const saved: Record<string, Array<Record<string, unknown>>> = {
      Role: [],
      UserRole: [],
    };
    let idCounter = 0;
    const nextId = () => `id-${++idCounter}`;

    function matchesWhere(
      record: Record<string, unknown>,
      where: Record<string, unknown>,
    ): boolean {
      return Object.entries(where).every(([key, criterion]) => {
        if (criterion instanceof FindOperator) {
          if (criterion.type === 'isNull')
            return record[key] === null || record[key] === undefined;
          if (criterion.type === 'in')
            return (criterion.value as unknown[]).includes(record[key]);
          return true;
        }
        return record[key] === criterion;
      });
    }

    // Faqat shu testlarda haqiqatan kerak bo'lgan relation'ni qo'lda "join" qiladi.
    function attachRelations(
      entityName: string,
      record: Record<string, unknown>,
      relations: unknown,
    ): Record<string, unknown> {
      if (!relations) return record;
      if (
        entityName === 'UserRole' &&
        (relations as Record<string, unknown>).role
      ) {
        const role = saved.Role.find((r) => r.id === record.roleId) ?? null;
        return { ...record, role };
      }
      return record;
    }

    function repoFor(entityClass: { name: string }) {
      const name = entityClass.name;
      if (!saved[name]) saved[name] = [];
      return {
        create: (data: unknown) =>
          Array.isArray(data)
            ? (data as Record<string, unknown>[]).map((d) => ({ ...d }))
            : { ...(data as Record<string, unknown>) },
        save: jest.fn((entityOrEntities: unknown) => {
          const isArray = Array.isArray(entityOrEntities);
          const list = (
            isArray ? entityOrEntities : [entityOrEntities]
          ) as Array<Record<string, unknown>>;
          const result = list.map((e) => {
            const withId = {
              ...e,
              id: (e.id as string | undefined) ?? nextId(),
            };
            const idx = saved[name].findIndex((r) => r.id === withId.id);
            if (idx >= 0) saved[name][idx] = withId;
            else saved[name].push(withId);
            return withId;
          });
          return isArray ? result : result[0];
        }),
        find: jest.fn(
          (
            options: {
              where?: Record<string, unknown>;
              relations?: unknown;
            } = {},
          ) => {
            const matches = saved[name].filter((r) =>
              matchesWhere(r, options.where ?? {}),
            );
            return matches.map((r) =>
              attachRelations(name, r, options.relations),
            );
          },
        ),
        findOne: jest.fn(
          (
            options: {
              where?: Record<string, unknown>;
              relations?: unknown;
            } = {},
          ) => {
            const match = saved[name].find((r) =>
              matchesWhere(r, options.where ?? {}),
            );
            return match
              ? attachRelations(name, match, options.relations)
              : null;
          },
        ),
        findOneBy: jest.fn((where: Record<string, unknown>) => {
          return saved[name].find((r) => matchesWhere(r, where)) ?? null;
        }),
        delete: jest.fn((criteria: Record<string, unknown>) => {
          const before = saved[name].length;
          saved[name] = saved[name].filter((r) => !matchesWhere(r, criteria));
          return { affected: before - saved[name].length };
        }),
      };
    }

    const manager = {
      query: jest.fn((sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return Promise.resolve([]);
      }),
      getRepository: jest.fn((entityClass: { name: string }) =>
        repoFor(entityClass),
      ),
    };

    return { manager, queries, saved };
  }

  function createService() {
    const fake = createFakeManager();
    const roleRepo = {
      manager: {
        transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) =>
          cb(fake.manager),
        ),
      },
    };
    const permissionsService = {
      ensureAllPermissionsExist: jest.fn(),
      findAll: jest.fn(),
    };
    const service = new RolesService(
      roleRepo as never,
      permissionsService as never,
    );
    return { service, roleRepo, permissionsService, ...fake };
  }

  // Haqiqiy tizimdagi kabi barcha (module, action) juftliklari — SYSTEM_ROLE_DEFINITIONS'ning
  // to'liq mos kelishini (masalan OWNER = ALL_ACTIONS x barcha modul) tekshirish uchun.
  function allPermissionFixtures() {
    const list: Array<{
      id: string;
      module: PermissionModule;
      action: PermissionAction;
    }> = [];
    for (const module of Object.values(PermissionModule)) {
      for (const action of Object.values(PermissionAction)) {
        list.push({ id: `${module}:${action}`, module, action });
      }
    }
    return list;
  }

  describe('seedSystemRolesForTenant', () => {
    it("tranzaksiya boshida app.tenant_id'ni RLS uchun o'rnatadi", async () => {
      const { service, permissionsService, queries } = createService();
      permissionsService.ensureAllPermissionsExist.mockResolvedValue(
        allPermissionFixtures(),
      );

      await service.seedSystemRolesForTenant('t1');

      const sqlMatcher: unknown = expect.stringContaining('set_config');
      expect(queries[0]).toMatchObject({
        sql: sqlMatcher,
        params: ['app.tenant_id', 't1'],
      });
    });

    it("SYSTEM_ROLE_DEFINITIONS'dagi barcha standart rollarni isSystem=true bilan yaratadi", async () => {
      const { service, permissionsService, saved } = createService();
      permissionsService.ensureAllPermissionsExist.mockResolvedValue(
        allPermissionFixtures(),
      );

      const roles = await service.seedSystemRolesForTenant('t1');

      expect(roles).toHaveLength(SYSTEM_ROLE_DEFINITIONS.length);
      expect(saved.Role).toHaveLength(SYSTEM_ROLE_DEFINITIONS.length);
      expect(
        roles.every((r) => r.isSystem === true && r.tenantId === 't1'),
      ).toBe(true);

      const owner = roles.find((r) => r.systemKey === SystemRoleKey.OWNER)!;
      // OWNER = barcha modul x barcha amal (ALL_ACTIONS) — role-permission-matrix.ts'ga qarang.
      expect(owner.permissions).toHaveLength(
        Object.values(PermissionModule).length *
          Object.values(PermissionAction).length,
      );
    });
  });

  describe('listRolesForTenant', () => {
    it("faqat berilgan tenant'ga tegishli rollarni qaytaradi", async () => {
      const { service, saved } = createService();
      saved.Role.push(
        {
          id: 'r1',
          tenantId: 't1',
          name: 'A',
          isSystem: false,
          permissions: [],
        },
        {
          id: 'r2',
          tenantId: 't2',
          name: 'B',
          isSystem: false,
          permissions: [],
        },
      );

      const roles = await service.listRolesForTenant('t1');

      expect(roles.map((r) => r.id)).toEqual(['r1']);
    });
  });

  describe('createCustomRole', () => {
    it("bo'sh nom uchun BadRequestException tashlaydi va tranzaksiya ochilmaydi", async () => {
      const { service, roleRepo } = createService();

      await expect(service.createCustomRole('t1', '   ', [])).rejects.toThrow(
        BadRequestException,
      );
      expect(roleRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('faqat tanlangan ruxsatlar bilan isSystem=false rol yaratadi', async () => {
      const { service, permissionsService } = createService();
      const perms = allPermissionFixtures();
      permissionsService.findAll.mockResolvedValue(perms);
      const selectedIds = [perms[0].id, perms[1].id];

      const role = await service.createCustomRole(
        't1',
        '  Maxsus rol  ',
        selectedIds,
      );

      expect(role.name).toBe('Maxsus rol');
      expect(role.isSystem).toBe(false);
      expect(role.tenantId).toBe('t1');
      expect(role.permissions).toHaveLength(2);
    });
  });

  describe('updateRolePermissions', () => {
    it("mavjud bo'lmagan rol uchun NotFoundException tashlaydi", async () => {
      const { service, permissionsService } = createService();
      permissionsService.findAll.mockResolvedValue(allPermissionFixtures());

      await expect(
        service.updateRolePermissions('t1', 'missing', []),
      ).rejects.toThrow(NotFoundException);
    });

    it('mavjud rolning ruxsatlarini yangilaydi', async () => {
      const { service, permissionsService, saved } = createService();
      const perms = allPermissionFixtures();
      permissionsService.findAll.mockResolvedValue(perms);
      saved.Role.push({
        id: 'r1',
        tenantId: 't1',
        name: 'A',
        isSystem: false,
        permissions: [],
      });

      const updated = await service.updateRolePermissions('t1', 'r1', [
        perms[0].id,
      ]);

      expect(updated.permissions).toHaveLength(1);
      expect(saved.Role.find((r) => r.id === 'r1')!.permissions).toHaveLength(
        1,
      );
    });

    it("boshqa tenant'ning rolini topa olmaydi (tenant izolyatsiyasi)", async () => {
      const { service, permissionsService, saved } = createService();
      permissionsService.findAll.mockResolvedValue(allPermissionFixtures());
      saved.Role.push({
        id: 'r1',
        tenantId: 't2',
        name: 'A',
        isSystem: false,
        permissions: [],
      });

      await expect(
        service.updateRolePermissions('t1', 'r1', []),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignRoleToUser', () => {
    it("mavjud bo'lmagan rol uchun NotFoundException tashlaydi", async () => {
      const { service } = createService();
      await expect(
        service.assignRoleToUser('t1', 'u1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('yangi tayinlash yaratadi', async () => {
      const { service, saved } = createService();
      saved.Role.push({
        id: 'r1',
        tenantId: 't1',
        name: 'Owner',
        isSystem: true,
        permissions: [],
      });

      const userRole = await service.assignRoleToUser('t1', 'u1', 'r1', null);

      expect(userRole).toMatchObject({
        tenantId: 't1',
        userId: 'u1',
        roleId: 'r1',
        propertyId: null,
      });
      expect(saved.UserRole).toHaveLength(1);
    });

    it('mavjud tayinlashni takrorlamaydi (idempotent)', async () => {
      const { service, saved } = createService();
      saved.Role.push({
        id: 'r1',
        tenantId: 't1',
        name: 'Owner',
        isSystem: true,
        permissions: [],
      });
      saved.UserRole.push({
        id: 'ur1',
        tenantId: 't1',
        userId: 'u1',
        roleId: 'r1',
        propertyId: null,
      });

      const result = await service.assignRoleToUser('t1', 'u1', 'r1', null);

      expect(result.id).toBe('ur1');
      expect(saved.UserRole).toHaveLength(1);
    });
  });

  describe('removeRoleFromUser', () => {
    it("mos keluvchi user_role yozuvini o'chiradi", async () => {
      const { service, saved } = createService();
      saved.UserRole.push(
        {
          id: 'ur1',
          tenantId: 't1',
          userId: 'u1',
          roleId: 'r1',
          propertyId: null,
        },
        {
          id: 'ur2',
          tenantId: 't1',
          userId: 'u2',
          roleId: 'r1',
          propertyId: null,
        },
      );

      await service.removeRoleFromUser('t1', 'u1', 'r1');

      expect(saved.UserRole.map((r) => r.id)).toEqual(['ur2']);
    });
  });

  describe('getEffectivePermissions', () => {
    it("tenant-darajasidagi (propertyId=null) rollar so'ralgan mulkdan qat'iy nazar hisobga olinadi", async () => {
      const { service, saved } = createService();
      const permA = {
        id: 'p1',
        module: PermissionModule.BOOKING,
        action: PermissionAction.VIEW,
      };
      saved.Role.push({
        id: 'r1',
        tenantId: 't1',
        name: 'Owner',
        isSystem: true,
        permissions: [permA],
      });
      saved.UserRole.push({
        id: 'ur1',
        tenantId: 't1',
        userId: 'u1',
        roleId: 'r1',
        propertyId: null,
      });

      const perms = await service.getEffectivePermissions('t1', 'u1', 'prop-1');

      expect(perms.has('booking:view')).toBe(true);
    });

    it("boshqa mulkka tegishli rol ruxsatlarini QO'SHMAYDI", async () => {
      const { service, saved } = createService();
      const permA = {
        id: 'p1',
        module: PermissionModule.WAREHOUSE,
        action: PermissionAction.EDIT,
      };
      saved.Role.push({
        id: 'r1',
        tenantId: 't1',
        name: 'Ombor mudiri',
        isSystem: true,
        permissions: [permA],
      });
      saved.UserRole.push({
        id: 'ur1',
        tenantId: 't1',
        userId: 'u1',
        roleId: 'r1',
        propertyId: 'prop-A',
      });

      const perms = await service.getEffectivePermissions('t1', 'u1', 'prop-B');

      expect(perms.has('warehouse:edit')).toBe(false);
    });

    it("mos mulkka tegishli rol ruxsatlarini qo'shadi", async () => {
      const { service, saved } = createService();
      const permA = {
        id: 'p1',
        module: PermissionModule.WAREHOUSE,
        action: PermissionAction.EDIT,
      };
      saved.Role.push({
        id: 'r1',
        tenantId: 't1',
        name: 'Ombor mudiri',
        isSystem: true,
        permissions: [permA],
      });
      saved.UserRole.push({
        id: 'ur1',
        tenantId: 't1',
        userId: 'u1',
        roleId: 'r1',
        propertyId: 'prop-A',
      });

      const perms = await service.getEffectivePermissions('t1', 'u1', 'prop-A');

      expect(perms.has('warehouse:edit')).toBe(true);
    });
  });

  describe('getRoleById', () => {
    it("mavjud bo'lmagan rol uchun NotFoundException tashlaydi", async () => {
      const { service } = createService();
      await expect(service.getRoleById('t1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('mavjud rolni ruxsatlari bilan qaytaradi', async () => {
      const { service, saved } = createService();
      saved.Role.push({
        id: 'r1',
        tenantId: 't1',
        name: 'Owner',
        isSystem: true,
        permissions: [],
      });

      const role = await service.getRoleById('t1', 'r1');

      expect(role.id).toBe('r1');
    });
  });

  describe('listUserRoleAssignments', () => {
    it("faqat berilgan tenant'ga tegishli tayinlashlarni qaytaradi", async () => {
      const { service, saved } = createService();
      saved.UserRole.push(
        {
          id: 'ur1',
          tenantId: 't1',
          userId: 'u1',
          roleId: 'r1',
          propertyId: null,
        },
        {
          id: 'ur2',
          tenantId: 't2',
          userId: 'u2',
          roleId: 'r2',
          propertyId: null,
        },
      );

      const assignments = await service.listUserRoleAssignments('t1');

      expect(assignments.map((a) => a.id)).toEqual(['ur1']);
    });
  });

  describe('findRolesByIds', () => {
    it("bo'sh massiv uchun tranzaksiya ochmasdan bo'sh natija qaytaradi", async () => {
      const { service, roleRepo } = createService();

      const roles = await service.findRolesByIds('t1', []);

      expect(roles).toEqual([]);
      expect(roleRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it("berilgan id ro'yxatiga mos rollarni qaytaradi", async () => {
      const { service, saved } = createService();
      saved.Role.push(
        {
          id: 'r1',
          tenantId: 't1',
          name: 'A',
          isSystem: false,
          permissions: [],
        },
        {
          id: 'r2',
          tenantId: 't1',
          name: 'B',
          isSystem: false,
          permissions: [],
        },
        {
          id: 'r3',
          tenantId: 't1',
          name: 'C',
          isSystem: false,
          permissions: [],
        },
      );

      const roles = await service.findRolesByIds('t1', ['r1', 'r3']);

      expect(roles.map((r) => r.id).sort()).toEqual(['r1', 'r3']);
    });
  });
});
