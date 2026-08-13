import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { Property } from '../modules/properties/entities/property.entity';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../modules/roles/entities/role.entity';
import { Permission } from '../modules/roles/entities/permission.entity';
import { UserRole } from '../modules/roles/entities/user-role.entity';
import { Guest } from '../modules/guests/entities/guest.entity';
import { RoomType } from '../modules/rooms/entities/room-type.entity';
import { Room } from '../modules/rooms/entities/room.entity';
import { Booking } from '../modules/bookings/entities/booking.entity';
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
    RoomType,
    Room,
    Booking,
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
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
