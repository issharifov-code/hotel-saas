import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { Property } from '../modules/properties/entities/property.entity';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../modules/roles/entities/role.entity';
import { Permission } from '../modules/roles/entities/permission.entity';
import { UserRole } from '../modules/roles/entities/user-role.entity';
import { Guest } from '../modules/guests/entities/guest.entity';
import { LoyaltyTransaction } from '../modules/guests/entities/loyalty-transaction.entity';
import { RoomType } from '../modules/rooms/entities/room-type.entity';
import { Room } from '../modules/rooms/entities/room.entity';
import { RatePlan } from '../modules/rooms/entities/rate-plan.entity';
import { RatePlanRestriction } from '../modules/rooms/entities/rate-plan-restriction.entity';
import { Booking } from '../modules/bookings/entities/booking.entity';
import { BookingGroup } from '../modules/bookings/entities/booking-group.entity';
import { Warehouse } from '../modules/warehouse/entities/warehouse.entity';
import { Supplier } from '../modules/warehouse/entities/supplier.entity';
import { StockItem } from '../modules/warehouse/entities/stock-item.entity';
import { StockLot } from '../modules/warehouse/entities/stock-lot.entity';
import { StockTransaction } from '../modules/warehouse/entities/stock-transaction.entity';
import { PurchaseOrder } from '../modules/warehouse/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../modules/warehouse/entities/purchase-order-item.entity';
import { PosOutlet } from '../modules/pos/entities/pos-outlet.entity';
import { MenuItem } from '../modules/pos/entities/menu-item.entity';
import { PosOrder } from '../modules/pos/entities/pos-order.entity';
import { PosOrderItem } from '../modules/pos/entities/pos-order-item.entity';
import { HousekeepingTask } from '../modules/housekeeping/entities/housekeeping-task.entity';
import { Invoice } from '../modules/invoicing/entities/invoice.entity';
import { InvoiceLine } from '../modules/invoicing/entities/invoice-line.entity';
import { InvoicePayment } from '../modules/invoicing/entities/invoice-payment.entity';
import { Account } from '../modules/accounting/entities/account.entity';
import { JournalEntry } from '../modules/accounting/entities/journal-entry.entity';
import { JournalEntryLine } from '../modules/accounting/entities/journal-entry-line.entity';
import { SubscriptionInvoice } from '../modules/billing/entities/subscription-invoice.entity';
import { NightAuditRun } from '../modules/night-audit/entities/night-audit-run.entity';
import { Agency } from '../modules/agencies/entities/agency.entity';
import { FunctionSpace } from '../modules/function-spaces/entities/function-space.entity';
import { FunctionSpaceBooking } from '../modules/function-spaces/entities/function-space-booking.entity';
import { MaintenanceTicket } from '../modules/maintenance/entities/maintenance-ticket.entity';
import { MessageTemplate } from '../modules/messaging/entities/message-template.entity';
import { MessageLog } from '../modules/messaging/entities/message-log.entity';
import { CorporateAccount } from '../modules/city-ledger/entities/corporate-account.entity';
import { Channel } from '../modules/channel-manager/entities/channel.entity';
import { ChannelRoomTypeMapping } from '../modules/channel-manager/entities/channel-room-type-mapping.entity';
import { ChannelSyncLog } from '../modules/channel-manager/entities/channel-sync-log.entity';
import { DemoRequest } from '../modules/marketing/entities/demo-request.entity';
import { PayrollRun } from '../modules/payroll/entities/payroll-run.entity';
import { PayslipEntry } from '../modules/payroll/entities/payslip-entry.entity';
import { AttendanceRecord } from '../modules/attendance/entities/attendance-record.entity';
import { Budget } from '../modules/budgets/entities/budget.entity';
import { LeaveRequest } from '../modules/attendance/entities/leave-request.entity';
import { InsightDismissal } from '../modules/reports/entities/insight-dismissal.entity';
import { ErrorEvent } from '../common/observability/entities/error-event.entity';
import { buildDbSsl } from '../common/utils/db-ssl.util';

// Migratsiya CLI (typeorm migration:generate/run) shu DataSource'dan foydalanadi.
// Runtime uchun esa app.module.ts'dagi TypeOrmModule.forRootAsync ishlatiladi.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'hotel_saas',
  password: process.env.DB_PASSWORD || 'hotel_saas_dev',
  database: process.env.DB_NAME || 'hotel_saas_dev',
  entities: [
    Tenant,
    Property,
    User,
    Role,
    Permission,
    UserRole,
    Guest,
    LoyaltyTransaction,
    RoomType,
    Room,
    RatePlan,
    RatePlanRestriction,
    Booking,
    BookingGroup,
    Warehouse,
    Supplier,
    StockItem,
    StockLot,
    StockTransaction,
    PurchaseOrder,
    PurchaseOrderItem,
    PosOutlet,
    MenuItem,
    PosOrder,
    PosOrderItem,
    HousekeepingTask,
    Invoice,
    InvoiceLine,
    InvoicePayment,
    Account,
    JournalEntry,
    JournalEntryLine,
    SubscriptionInvoice,
    NightAuditRun,
    Agency,
    FunctionSpace,
    FunctionSpaceBooking,
    MaintenanceTicket,
    MessageTemplate,
    MessageLog,
    CorporateAccount,
    Channel,
    ChannelRoomTypeMapping,
    ChannelSyncLog,
    DemoRequest,
    PayrollRun,
    PayslipEntry,
    AttendanceRecord,
    Budget,
    LeaveRequest,
    InsightDismissal,
    ErrorEvent,
  ],
  // __dirname asosida — ts-node orqali ishga tushirilganda (`src/database`) ham,
  // build qilingan holda (`dist/database`) ham to'g'ri migratsiyalarni topadi.
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  // 🔴 XAVFSIZLIK AUDITI (2026-09-05, M8) — izoh `common/utils/db-ssl.util.ts` da.
  ssl: buildDbSsl({
    enabled: process.env.DB_SSL === 'true',
    ca: process.env.DB_SSL_CA,
    isProduction: process.env.NODE_ENV === 'production',
  }),
});
