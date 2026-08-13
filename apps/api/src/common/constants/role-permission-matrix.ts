import { PermissionAction, PermissionModule, SystemRoleKey } from '../enums/permission.enum';

export interface SystemRoleDefinition {
  key: SystemRoleKey;
  name: string; // O'zbekcha ko'rsatiladigan nom
  permissions: Array<{ module: PermissionModule; actions: PermissionAction[] }>;
}

const ALL_ACTIONS = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.EDIT,
  PermissionAction.DELETE,
  PermissionAction.APPROVE,
];

// Texnik arxitektura hujjatidagi 4.1-bo'lim ("Namunaviy ruxsatlar matritsasi")ning
// kodga aylantirilgan versiyasi. Yangi tenant ro'yxatdan o'tganda shu asosda
// standart rollar avtomatik yaratiladi (AuthService.registerTenant orqali).
export const SYSTEM_ROLE_DEFINITIONS: SystemRoleDefinition[] = [
  {
    key: SystemRoleKey.OWNER,
    name: 'Egasi / Bosh menejer',
    permissions: Object.values(PermissionModule).map((module) => ({
      module,
      actions: ALL_ACTIONS,
    })),
  },
  {
    key: SystemRoleKey.ACCOUNTANT,
    name: 'Buxgalter',
    permissions: [
      { module: PermissionModule.BOOKING, actions: [PermissionAction.VIEW] },
      { module: PermissionModule.FRONT_DESK, actions: [PermissionAction.VIEW] },
      { module: PermissionModule.HOUSEKEEPING, actions: [PermissionAction.VIEW] },
      { module: PermissionModule.WAREHOUSE, actions: [PermissionAction.VIEW] },
      { module: PermissionModule.POS, actions: [PermissionAction.VIEW] },
      { module: PermissionModule.GUEST_CRM, actions: [PermissionAction.VIEW] },
      {
        module: PermissionModule.INVOICING,
        actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT],
      },
      { module: PermissionModule.ACCOUNTING, actions: ALL_ACTIONS },
      { module: PermissionModule.REPORTS, actions: [PermissionAction.VIEW] },
      { module: PermissionModule.BILLING, actions: [PermissionAction.VIEW] },
    ],
  },
  {
    key: SystemRoleKey.FRONT_DESK_STAFF,
    name: 'Front Desk xodimi',
    permissions: [
      {
        module: PermissionModule.BOOKING,
        actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT],
      },
      {
        module: PermissionModule.FRONT_DESK,
        actions: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.APPROVE, // check-in/out tasdiqlash
        ],
      },
      { module: PermissionModule.HOUSEKEEPING, actions: [PermissionAction.VIEW] },
      {
        module: PermissionModule.GUEST_CRM,
        actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT],
      },
      {
        module: PermissionModule.INVOICING,
        actions: [PermissionAction.VIEW, PermissionAction.CREATE],
      },
    ],
  },
  {
    key: SystemRoleKey.HOUSEKEEPING_SUPERVISOR,
    name: 'Housekeeping nazoratchisi',
    permissions: [
      {
        module: PermissionModule.HOUSEKEEPING,
        actions: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.APPROVE,
        ],
      },
      { module: PermissionModule.FRONT_DESK, actions: [PermissionAction.VIEW] },
      { module: PermissionModule.WAREHOUSE, actions: [PermissionAction.VIEW] },
    ],
  },
  {
    key: SystemRoleKey.WAREHOUSE_MANAGER,
    name: 'Ombor mudiri',
    permissions: [
      { module: PermissionModule.WAREHOUSE, actions: ALL_ACTIONS },
      { module: PermissionModule.ACCOUNTING, actions: [PermissionAction.VIEW] },
    ],
  },
  {
    key: SystemRoleKey.POS_STAFF,
    name: 'F&B / POS xodimi',
    permissions: [
      {
        module: PermissionModule.POS,
        actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT],
      },
      { module: PermissionModule.WAREHOUSE, actions: [PermissionAction.VIEW] },
      {
        module: PermissionModule.INVOICING,
        actions: [PermissionAction.VIEW, PermissionAction.CREATE],
      },
    ],
  },
];
