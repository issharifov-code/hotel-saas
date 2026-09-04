// Cheksiz o'sadigan ro'yxatlar (invoyslar, xabar loglari, night-audit tarixi,
// channel-manager sinxronlash loglari va h.k.) uchun umumiy sahifalangan javob shakli.
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RoomTypeDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  basePrice: string;
  maxOccupancy: number;
  description: string | null;
  createdAt: string;
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'out_of_order';
export type HousekeepingStatus = 'clean' | 'dirty' | 'in_progress' | 'inspected';

export interface RoomDto {
  id: string;
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  roomType?: RoomTypeDto;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  createdAt: string;
}

export type CancellationFeeType = 'flat' | 'percent_of_total' | 'first_night';

export interface RatePlanDto {
  id: string;
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  name: string;
  nightlyPrice: string;
  isRefundable: boolean;
  isActive: boolean;
  description: string | null;
  cancellationDeadlineDays: number | null;
  cancellationFeeType: CancellationFeeType | null;
  cancellationFeeValue: string | null;
  noShowFeeType: CancellationFeeType | null;
  noShowFeeValue: string | null;
  createdAt: string;
}

export interface RatePlanRestrictionDto {
  id: string;
  ratePlanId: string;
  date: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minLengthOfStay: number | null;
  maxLengthOfStay: number | null;
  stopSell: boolean;
  createdAt: string;
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'adjust';
export type CommunicationPreference = 'email' | 'sms' | 'phone' | 'none';

export interface GuestDto {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  roomPreference: string | null;
  dietaryPreference: string | null;
  communicationPreference: CommunicationPreference;
  loyaltyTier: LoyaltyTier;
  loyaltyPoints: number;
  lifetimePoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyTransactionDto {
  id: string;
  guestId: string;
  type: LoyaltyTransactionType;
  points: number;
  reason: string;
  relatedInvoiceId: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type BookingSource = 'direct' | 'website' | 'ota' | 'exely';
export type MarketSegment = 'walk_in' | 'corporate' | 'ota' | 'travel_agent' | 'group' | 'government' | 'other';

export interface BookingDto {
  id: string;
  tenantId: string;
  propertyId: string;
  property?: PropertyDto;
  roomId: string;
  room?: RoomDto;
  guestId: string;
  guest?: GuestDto;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  source: BookingSource;
  marketSegment: MarketSegment;
  ratePlanId: string | null;
  totalAmount: string;
  currency: string;
  externalRef: string | null;
  notes: string | null;
  cancellationFeeAmount: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Guruh/blok bron ---

export interface BookingGroupDto {
  id: string;
  tenantId: string;
  propertyId: string;
  groupName: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdByUserId: string;
  bookings: BookingDto[];
  createdAt: string;
}

// --- Turizm agentliklari (Agencies) ---

export interface AgencyDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  commissionPct: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AgencySummaryDto {
  agencyId: string;
  bookingCount: number;
  totalRevenue: string;
  commissionOwed: string;
}

// --- City Ledger / Korporativ hisoblar (Corporate Accounts) ---

export interface CorporateAccountDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  taxId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  billingAddress: string | null;
  creditLimit: string | null;
  paymentTermsDays: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CityLedgerStatementLineDto {
  invoiceId: string;
  bookingId: string;
  guestName: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  issuedAt: string | null;
  isOverdue: boolean;
}

export interface CityLedgerStatementDto {
  corporateAccountId: string;
  paymentTermsDays: number;
  creditLimit: string | null;
  invoiceCount: number;
  totalCharged: string;
  totalPaid: string;
  totalBalance: string;
  overdueBalance: string;
  lines: CityLedgerStatementLineDto[];
}

// --- Function Space / Events (banket zali, konferensiya xonasi) ---

export interface FunctionSpaceDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  capacity: number;
  dailyRate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export type FunctionSpaceBookingStatus = 'tentative' | 'confirmed' | 'cancelled';

export interface FunctionSpaceBookingDto {
  id: string;
  tenantId: string;
  propertyId: string;
  functionSpaceId: string;
  functionSpace?: FunctionSpaceDto;
  eventName: string;
  organizerName: string;
  organizerPhone: string | null;
  organizerEmail: string | null;
  startTime: string;
  endTime: string;
  attendeeCount: number | null;
  setupStyle: string | null;
  status: FunctionSpaceBookingStatus;
  totalAmount: string | null;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
}

// --- Texnik xizmat so'rovlari (Maintenance / Work Orders) ---

export type MaintenanceTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceTicketStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export interface MaintenanceTicketDto {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId: string;
  room?: RoomDto;
  title: string;
  description: string | null;
  priority: MaintenanceTicketPriority;
  status: MaintenanceTicketStatus;
  reportedByUserId: string;
  assignedToUserId: string | null;
  resolutionNotes: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// --- Xabar shablonlari va yuborilgan xabarlar (Guest Messaging) ---

export type MessageChannel = 'email' | 'sms';
export type MessageTriggerType = 'booking_confirmed' | 'checked_in' | 'checked_out' | 'custom';
export type MessageStatus = 'sent' | 'failed';

export interface MessageTemplateDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  triggerType: MessageTriggerType;
  channel: MessageChannel;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLogDto {
  id: string;
  tenantId: string;
  propertyId: string;
  guestId: string;
  guest?: GuestDto;
  bookingId: string | null;
  templateId: string | null;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  status: MessageStatus;
  provider: string | null;
  providerRef: string | null;
  failureReason: string | null;
  sentByUserId: string;
  createdAt: string;
}

export interface PropertyDto {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  currency: string;
  businessDate: string;
  createdAt: string;
  // Mehmonxonaning o'z logotipi — `data:image/...;base64,...` matni
  // (Render API'sida doimiy disk yo'q, shuning uchun rasm bazada saqlanadi).
  // `null` bo'lsa yuqori panelda nomining bosh harfi ko'rsatiladi.
  logoUrl: string | null;
}

// --- Budjet (oylik moliyaviy reja) ---

// Uch ko'rsatkich ham `null` bo'lishi mumkin — mehmonxona faqat o'ziga
// kerakligini rejalashtiradi. Pul/foiz qiymatlari matn sifatida (backend'da
// numeric ustunlar, float xatoliklarisiz).
export interface BudgetDto {
  id: string;
  propertyId: string;
  year: number;
  month: number;
  roomsRevenue: string | null;
  occupancyRatePct: string | null;
  adr: string | null;
}

// --- Night Audit ("kunni yopish") ---

export interface NightAuditStatusDto {
  businessDate: string;
  pendingNoShows: number;
  lastAuditDate: string | null;
  lastRunAt: string | null;
}

export interface NightAuditRunDto {
  id: string;
  auditDate: string;
  totalRooms: number;
  occupiedRooms: number;
  occupancyRatePct: string;
  adr: string;
  revPar: string;
  roomRevenue: string;
  noShowsProcessed: number;
  runByUserId: string;
  createdAt: string;
}

// --- Warehouse (Ombor) ---

export interface WarehouseDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface StockItemDto {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  unit: string;
  category: string | null;
  reorderPoint: string;
  isActive: boolean;
  createdAt: string;
}

export interface SupplierDto {
  id: string;
  tenantId: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

export interface StockLevelDto {
  stockItemId: string;
  sku: string;
  name: string;
  unit: string;
  reorderPoint: string;
  quantityOnHand: string;
  belowReorderPoint: boolean;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderItemDto {
  id: string;
  purchaseOrderId: string;
  stockItemId: string;
  stockItem?: StockItemDto;
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
}

export interface PurchaseOrderDto {
  id: string;
  tenantId: string;
  propertyId: string;
  warehouseId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  totalAmount: string;
  currency: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  notes: string | null;
  items: PurchaseOrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

// --- POS (Restoran/Bar) ---

export interface PosOutletDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface MenuItemDto {
  id: string;
  tenantId: string;
  name: string;
  category: string | null;
  price: string;
  isActive: boolean;
  createdAt: string;
}

export type PosOrderStatus = 'open' | 'paid' | 'cancelled';
export type PosPaymentMethod = 'cash' | 'card' | 'room_account';

export interface PosOrderItemDto {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem?: MenuItemDto;
  quantity: number;
  unitPrice: string;
  notes: string | null;
}

export interface PosOrderDto {
  id: string;
  tenantId: string;
  propertyId: string;
  outletId: string;
  status: PosOrderStatus;
  tableNumber: string | null;
  guestId: string | null;
  bookingId: string | null;
  paymentMethod: PosPaymentMethod | null;
  totalAmount: string;
  currency: string;
  createdByUserId: string;
  paidAt: string | null;
  notes: string | null;
  items: PosOrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

// --- Housekeeping ---

export type HousekeepingTaskStatus = 'pending' | 'in_progress' | 'done' | 'inspected' | 'cancelled';

export interface HousekeepingTaskDto {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId: string;
  room?: RoomDto;
  status: HousekeepingTaskStatus;
  assignedToUserId: string | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  inspectedAt: string | null;
  inspectedByUserId: string | null;
  createdAt: string;
}

// --- Invoicing (Hisob-faktura) ---

export type InvoiceStatus = 'open' | 'issued' | 'paid' | 'cancelled';
export type InvoiceLineSource = 'room_charge' | 'pos_order' | 'manual';
export type InvoicePaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'online';

export interface InvoiceLineDto {
  id: string;
  invoiceId: string;
  description: string;
  source: InvoiceLineSource;
  sourceId: string | null;
  quantity: string;
  unitPrice: string;
  amount: string;
  createdAt: string;
}

export interface InvoicePaymentDto {
  id: string;
  invoiceId: string;
  amount: string;
  method: InvoicePaymentMethod;
  receivedByUserId: string;
  notes: string | null;
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
}

export interface PaymentProviderDto {
  provider: string;
}

export interface InvoiceDto {
  id: string;
  tenantId: string;
  propertyId: string;
  bookingId: string;
  booking?: BookingDto;
  guestId: string;
  guest?: GuestDto;
  status: InvoiceStatus;
  totalAmount: string;
  paidAmount: string;
  currency: string;
  issuedAt: string | null;
  lines?: InvoiceLineDto[];
  payments?: InvoicePaymentDto[];
  createdAt: string;
  updatedAt: string;
}

// --- Accounting (Moliyaviy hisob / USALI) ---

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountDepartment =
  | 'rooms'
  | 'food_beverage'
  | 'other_operated'
  | 'miscellaneous_income'
  | 'admin_general'
  | 'info_telecom'
  | 'sales_marketing'
  | 'property_maintenance'
  | 'energy_water_waste'
  | 'payroll_related'
  | 'management_fees'
  | 'nonoperating'
  | 'undistributed_expenses'
  | 'fixed_charges';

export type NormalBalance = 'debit' | 'credit';

export interface AccountDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  department: AccountDepartment | null;
  normalBalance: NormalBalance;
  systemKey: string | null;
  isActive: boolean;
  createdAt: string;
}

export type JournalEntrySourceModule = 'invoicing' | 'pos' | 'warehouse' | 'manual';

export interface JournalEntryLineDto {
  id: string;
  journalEntryId: string;
  accountId: string;
  account?: AccountDto;
  debit: string;
  credit: string;
  description: string | null;
}

export interface JournalEntryDto {
  id: string;
  tenantId: string;
  propertyId: string;
  entryDate: string;
  description: string;
  sourceModule: JournalEntrySourceModule;
  sourceId: string | null;
  createdByUserId: string | null;
  lines: JournalEntryLineDto[];
  createdAt: string;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface IncomeStatementRow {
  accountId: string;
  code: string;
  name: string;
  department: AccountDepartment | null;
  amount: string;
}

export interface IncomeStatementDto {
  revenue: IncomeStatementRow[];
  expense: IncomeStatementRow[];
}

// --- Billing / SaaS Billing ---

export type TenantPlan = 'start' | 'professional' | 'enterprise';
export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
export type SubscriptionInvoiceStatus = 'pending' | 'paid' | 'cancelled';

export interface PlanPricingDto {
  plan: TenantPlan;
  label: string;
  monthlyPrice: number;
  currency: string;
  maxProperties: number;
  maxUsers: number;
}

export interface SubscriptionInvoiceDto {
  id: string;
  tenantId: string;
  plan: TenantPlan;
  periodStart: string;
  periodEnd: string;
  amount: string;
  currency: string;
  status: SubscriptionInvoiceStatus;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  markedPaidByUserId: string | null;
  notes: string | null;
  createdAt: string;
  isOverdue: boolean;
}

export interface AdminSubscriptionInvoiceDto extends SubscriptionInvoiceDto {
  tenantName: string | null;
}

export interface TenantSubscriptionDto {
  plan: TenantPlan;
  status: TenantStatus;
  pricing: PlanPricingDto;
  latestInvoice: SubscriptionInvoiceDto | null;
}

export interface TenantDto {
  id: string;
  name: string;
  subdomain: string;
  baseCurrency: string;
  status: TenantStatus;
  plan: TenantPlan;
  createdAt: string;
  updatedAt: string;
}

// --- Booking Engine (jonli, autentifikatsiyasiz bron widget'i) ---

export interface PublicPropertyDto {
  id: string;
  name: string;
  address: string | null;
  currency: string;
}

export interface PublicRatePlanDto {
  id: string;
  name: string;
  nightlyPrice: string;
  isRefundable: boolean;
}

export interface PublicAvailabilityDto {
  roomTypeId: string;
  name: string;
  description: string | null;
  maxOccupancy: number;
  availableCount: number;
  nightlyPriceFrom: number;
  ratePlans: PublicRatePlanDto[];
}

export interface PublicBookingResultDto {
  id: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  currency: string;
  status: BookingStatus;
}

// --- Reports / Dashboard ---

export interface ReportsOverviewDto {
  asOfDate: string;
  periodDays: number;
  occupancy: {
    totalRooms: number;
    occupiedRooms: number;
    occupancyRatePct: number;
  };
  todayArrivals: number;
  todayDepartures: number;
  inHouseBookings: number;
  adr: number;
  revPar: number;
  revenueTrend: { date: string; amount: number }[];
  // Dashboard grafigidagi Revenue/ADR/Occupancy almashtirgichi uchun — kunning
  // o'zida FAOL bo'lgan bronlar asosida (revenueTrend'dan farqli, u qabul
  // qilingan to'lov sanasiga tayanadi). Qarang: apps/api/.../reports.service.ts.
  occupancyTrend: { date: string; occupancyRatePct: number }[];
  adrTrend: { date: string; adr: number }[];
  outstandingInvoices: { count: number; totalBalance: number };
  housekeepingPending: number;
  loyaltyDistribution: { tier: LoyaltyTier; count: number }[];
  // Bevosita oldingi, xuddi shunday uzunlikdagi davrga nisbatan foiz o'zgarish
  // (Dashboard'dagi trend strelkalari uchun) — oldingi davrda ma'lumot bo'lmasa
  // (masalan yangi mehmonxona) `null`, frontend bunday holatda strelkani
  // ko'rsatmaydi. Qarang: apps/api/.../reports.service.ts getOverview.
  trend: {
    occupancyRatePctDelta: number | null;
    adrDelta: number | null;
    revParDelta: number | null;
  };
}

export interface SegmentPerformanceDto {
  periodDays: number;
  bySegment: {
    segment: MarketSegment;
    bookingCount: number;
    roomNights: number;
    revenue: number;
    adr: number;
  }[];
  bySource: { source: BookingSource; bookingCount: number; revenue: number }[];
  byAgency: {
    agencyId: string;
    agencyName: string;
    bookingCount: number;
    revenue: number;
    commissionOwed: number;
  }[];
  byCorporateAccount: {
    corporateAccountId: string;
    name: string;
    bookingCount: number;
    revenue: number;
  }[];
}

export interface GuestRegistrationStayDto {
  bookingId: string;
  guestFullName: string;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  missingDocument: boolean;
}

export interface GuestRegistrationReportDto {
  periodDays: number;
  totalStays: number;
  missingDocumentCount: number;
  stays: GuestRegistrationStayDto[];
  page: number;
  pageSize: number;
}

// --- Xodimlar va ruxsatlar (Staff & Roles/Permissions, 2026-09) ---

export type UserStatus = 'active' | 'invited' | 'disabled';

export interface StaffUserDto {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  createdAt: string;
}

// Maosh — alohida, PAYROLL ruxsati bilan himoyalangan endpoint orqali
// olinadi/o'rnatiladi (StaffUserDto/`/users` ro'yxatida YO'Q — boshqa
// xodimlarning maoshi USERS_ROLES:view huquqi orqali ko'rinib qolmasligi
// uchun ataylab ajratilgan).
export type SalaryType = 'monthly' | 'hourly';

export interface StaffSalaryDto {
  salaryType: SalaryType | null;
  salaryAmount: string | null;
}

export type PermissionModuleKey =
  | 'booking'
  | 'front_desk'
  | 'housekeeping'
  | 'warehouse'
  | 'pos'
  | 'guest_crm'
  | 'invoicing'
  | 'accounting'
  | 'reports'
  | 'billing'
  | 'users_roles'
  | 'tenant_settings'
  | 'payroll';

export type PermissionActionKey = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export interface PermissionDto {
  id: string;
  module: PermissionModuleKey;
  action: PermissionActionKey;
  description: string | null;
}

export interface RoleDto {
  id: string;
  tenantId: string | null;
  name: string;
  systemKey: string | null;
  isSystem: boolean;
  permissions: PermissionDto[];
  createdAt: string;
}

export interface UserRoleAssignmentDto {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  propertyId: string | null;
  createdAt: string;
}

// --- Channel Manager (OTA distribution — Booking.com, Airbnb va h.k.) ---

export type ChannelProvider = 'booking_com' | 'airbnb' | 'agoda' | 'expedia' | 'other';

export interface ChannelDto {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  provider: ChannelProvider;
  externalPropertyId: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface ChannelRoomTypeMappingDto {
  id: string;
  channelId: string;
  roomTypeId: string;
  ratePlanId: string | null;
  externalRoomTypeId: string | null;
  isActive: boolean;
  createdAt: string;
}

export type ChannelSyncStatus = 'success' | 'failed';

export interface ChannelSyncLogDto {
  id: string;
  channelId: string;
  syncedAt: string;
  status: ChannelSyncStatus;
  roomTypesSynced: number;
  daysSynced: number;
  summary: string;
  providerRef: string | null;
  failureReason: string | null;
}

// --- Demo so'rovlar (login sahifasidagi "Demo so'rash" formasi, 2026-09) ---
export interface DemoRequestDto {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  note: string | null;
  contacted: boolean;
  createdAt: string;
}

// --- Payroll / Ish haqi (2026-09) ---

export type PayrollRunStatus = 'draft' | 'finalized' | 'paid';

export interface PayslipEntryDto {
  id: string;
  payrollRunId: string;
  userId: string | null;
  employeeNameSnapshot: string;
  salaryType: SalaryType;
  rateSnapshot: string;
  hoursWorked: string | null;
  grossAmount: string;
  adjustmentAmount: string;
  adjustmentNote: string | null;
  netAmount: string;
  createdAt: string;
}

export interface PayrollRunDto {
  id: string;
  propertyId: string;
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
  totalAmount: string;
  runByUserId: string;
  finalizedByUserId: string | null;
  finalizedAt: string | null;
  paidAt: string | null;
  // Faqat bitta run tafsilotini olishda (`GET /payroll-runs/:id`) keladi —
  // ro'yxat endpointida (`GET /payroll-runs`) yo'q.
  entries?: PayslipEntryDto[];
  createdAt: string;
}

// --- Davomat / Ta'til (2026-09) — Payroll'ning "hours entered manually"
// bo'shlig'ini to'ldiradi (Payroll'da hujjatlashtirilgan gap). Mavjud
// `payroll` PermissionModule'i qayta ishlatiladi (yangi modul qiymati YO'Q).

export interface StaffRosterEntryDto {
  id: string;
  fullName: string;
  salaryType: SalaryType | null;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday';

export interface AttendanceRecordDto {
  id: string;
  tenantId: string;
  propertyId: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  hoursWorked: string | null;
  notes: string | null;
  recordedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type LeaveType = 'vacation' | 'sick' | 'unpaid' | 'other';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequestDto {
  id: string;
  tenantId: string;
  propertyId: string;
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveRequestStatus;
  requestedByUserId: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
}
