import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { RlsContextModule } from './common/rls/rls-context.module';
import { RlsTransactionInterceptor } from './common/rls/rls-transaction.interceptor';

import { Tenant } from './modules/tenants/entities/tenant.entity';
import { Property } from './modules/properties/entities/property.entity';
import { User } from './modules/users/entities/user.entity';
import { Role } from './modules/roles/entities/role.entity';
import { Permission } from './modules/roles/entities/permission.entity';
import { UserRole } from './modules/roles/entities/user-role.entity';
import { Guest } from './modules/guests/entities/guest.entity';
import { LoyaltyTransaction } from './modules/guests/entities/loyalty-transaction.entity';
import { RoomType } from './modules/rooms/entities/room-type.entity';
import { Room } from './modules/rooms/entities/room.entity';
import { RatePlan } from './modules/rooms/entities/rate-plan.entity';
import { RatePlanRestriction } from './modules/rooms/entities/rate-plan-restriction.entity';
import { Booking } from './modules/bookings/entities/booking.entity';
import { BookingGroup } from './modules/bookings/entities/booking-group.entity';
import { Warehouse } from './modules/warehouse/entities/warehouse.entity';
import { Supplier } from './modules/warehouse/entities/supplier.entity';
import { StockItem } from './modules/warehouse/entities/stock-item.entity';
import { StockLot } from './modules/warehouse/entities/stock-lot.entity';
import { StockTransaction } from './modules/warehouse/entities/stock-transaction.entity';
import { PurchaseOrder } from './modules/warehouse/entities/purchase-order.entity';
import { PurchaseOrderItem } from './modules/warehouse/entities/purchase-order-item.entity';
import { PosOutlet } from './modules/pos/entities/pos-outlet.entity';
import { MenuItem } from './modules/pos/entities/menu-item.entity';
import { PosOrder } from './modules/pos/entities/pos-order.entity';
import { PosOrderItem } from './modules/pos/entities/pos-order-item.entity';
import { HousekeepingTask } from './modules/housekeeping/entities/housekeeping-task.entity';
import { Invoice } from './modules/invoicing/entities/invoice.entity';
import { InvoiceLine } from './modules/invoicing/entities/invoice-line.entity';
import { InvoicePayment } from './modules/invoicing/entities/invoice-payment.entity';
import { Account } from './modules/accounting/entities/account.entity';
import { JournalEntry } from './modules/accounting/entities/journal-entry.entity';
import { JournalEntryLine } from './modules/accounting/entities/journal-entry-line.entity';
import { SubscriptionInvoice } from './modules/billing/entities/subscription-invoice.entity';
import { NightAuditRun } from './modules/night-audit/entities/night-audit-run.entity';
import { Agency } from './modules/agencies/entities/agency.entity';
import { FunctionSpace } from './modules/function-spaces/entities/function-space.entity';
import { FunctionSpaceBooking } from './modules/function-spaces/entities/function-space-booking.entity';
import { MaintenanceTicket } from './modules/maintenance/entities/maintenance-ticket.entity';
import { MessageTemplate } from './modules/messaging/entities/message-template.entity';
import { MessageLog } from './modules/messaging/entities/message-log.entity';
import { CorporateAccount } from './modules/city-ledger/entities/corporate-account.entity';
import { Channel } from './modules/channel-manager/entities/channel.entity';
import { ChannelRoomTypeMapping } from './modules/channel-manager/entities/channel-room-type-mapping.entity';
import { ChannelSyncLog } from './modules/channel-manager/entities/channel-sync-log.entity';
import { DemoRequest } from './modules/marketing/entities/demo-request.entity';
import { PayrollRun } from './modules/payroll/entities/payroll-run.entity';
import { PayslipEntry } from './modules/payroll/entities/payslip-entry.entity';
import { AttendanceRecord } from './modules/attendance/entities/attendance-record.entity';
import { Budget } from './modules/budgets/entities/budget.entity';
import { LeaveRequest } from './modules/attendance/entities/leave-request.entity';
import { InsightDismissal } from './modules/reports/entities/insight-dismissal.entity';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { RolesModule } from './modules/roles/roles.module';
import { GuestsModule } from './modules/guests/guests.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { PosModule } from './modules/pos/pos.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { InvoicingModule } from './modules/invoicing/invoicing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BillingModule } from './modules/billing/billing.module';
import { PublicModule } from './modules/public/public.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { SampleDataModule } from './modules/sample-data/sample-data.module';
import { NightAuditModule } from './modules/night-audit/night-audit.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { FunctionSpacesModule } from './modules/function-spaces/function-spaces.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { CityLedgerModule } from './modules/city-ledger/city-ledger.module';
import { ChannelManagerModule } from './modules/channel-manager/channel-manager.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { BudgetsModule } from './modules/budgets/budgets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        // Runtime ulanish jadval egasi bo'lmagan `hotel_saas_app` roli orqali
        // ishlaydi — shu bilan Row-Level Security siyosatlari (RLS migratsiyasi
        // qarang) ilovaning o'ziga ham qo'llaniladi. Migratsiya/seed skriptlari
        // esa hamon `database.username` (jadval egasi) orqali ishlaydi.
        username: config.get<string>('database.appUsername'),
        password: config.get<string>('database.appPassword'),
        database: config.get<string>('database.name'),
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
        ],
        // Migration-based flow: sxema endi `pnpm migration:run` orqali boshqariladi
        // (src/database/data-source.ts + src/database/migrations/). `synchronize`
        // har doim o'chirilgan — dev muhitida ham, chunki noto'g'ri/kutilmagan
        // sxema o'zgarishlarining oldini olish uchun migratsiya yagona yo'l bo'lishi kerak.
        synchronize: false,
        logging: config.get<string>('nodeEnv') === 'development',
        ssl: config.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
    // 🔴 XAVFSIZLIK AUDITI (2026-09-05, High). Ilgari ilovada hech qanday
    // rate limiting yo'q edi: `POST /auth/login` cheksiz parol tanlashga,
    // `POST /auth/register-tenant` cheksiz tenant yaratishga, ochiq bron
    // vidjeti esa soxta bronlar bilan inventarni to'ldirishga ochiq edi.
    //
    // `default` — umumiy shift: SPA bitta sahifada 10-15 so'rov yuboradi,
    // shuning uchun chegara keng, u faqat qo'pol suiiste'molni to'sadi.
    // Nozik yo'llar o'z nomlangan chegarasini `@Throttle` bilan qo'shadi
    // (`auth.controller.ts`, `public-booking.controller.ts`,
    // `demo-request.controller.ts`).
    //
    // ESLATMA: hisoblagich xotirada (instansiyaga xos). Bugun bitta
    // instansiya ishlaydi; ko'p nusxaga o'tilganda umumiy saqlagich
    // (Redis) kerak bo'ladi.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 300 },
    ]),
    RlsContextModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    RolesModule,
    GuestsModule,
    RoomsModule,
    BookingsModule,
    WarehouseModule,
    PosModule,
    PropertiesModule,
    HousekeepingModule,
    InvoicingModule,
    PaymentsModule,
    AccountingModule,
    ReportsModule,
    BillingModule,
    PublicModule,
    MarketingModule,
    SampleDataModule,
    NightAuditModule,
    AgenciesModule,
    FunctionSpacesModule,
    MaintenanceModule,
    MessagingModule,
    CityLedgerModule,
    ChannelManagerModule,
    AttendanceModule,
    PayrollModule,
    BudgetsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global — ya'ni yangi marshrut qo'shilganda uni ulashni unutib
    // bo'lmaydi (auditda aynan shunday "unutilgan" naqshlar topilgan).
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RlsTransactionInterceptor },
  ],
})
export class AppModule {}
