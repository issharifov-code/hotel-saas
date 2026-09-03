// USALI-mos hotel SaaS uchun modul va amal darajasidagi ruxsatlar.
// Har bir Permission = (module, action) juftligi. Role bir nechta Permission'ga ega bo'ladi.

export enum PermissionModule {
  BOOKING = 'booking', // Bron / Xona boshqaruvi
  FRONT_DESK = 'front_desk', // Check-in/out
  HOUSEKEEPING = 'housekeeping',
  WAREHOUSE = 'warehouse', // Ombor
  POS = 'pos',
  GUEST_CRM = 'guest_crm',
  INVOICING = 'invoicing',
  ACCOUNTING = 'accounting', // Moliyaviy hisob (COA/USALI)
  REPORTS = 'reports',
  BILLING = 'billing', // SaaS obuna to'lovlari
  USERS_ROLES = 'users_roles', // Role Management
  TENANT_SETTINGS = 'tenant_settings',
  PAYROLL = 'payroll', // Xodimlar maoshi / ish haqi hisob-kitobi
}

export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  APPROVE = 'approve', // masalan, moliyaviy provodkani tasdiqlash
}

// Standart (tizim) rollari — har bir yangi tenant uchun avtomatik yaratiladi.
export enum SystemRoleKey {
  OWNER = 'owner', // Egasi / Bosh menejer — to'liq huquq
  ACCOUNTANT = 'accountant',
  FRONT_DESK_STAFF = 'front_desk_staff',
  HOUSEKEEPING_SUPERVISOR = 'housekeeping_supervisor',
  WAREHOUSE_MANAGER = 'warehouse_manager',
  POS_STAFF = 'pos_staff',
}

// Platforma darajasidagi (tenant'dan tashqari) super-admin — Tenant Management uchun.
export const PLATFORM_SUPER_ADMIN = 'platform_super_admin';
