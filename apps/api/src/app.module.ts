import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';

import { Tenant } from './modules/tenants/entities/tenant.entity';
import { Property } from './modules/properties/entities/property.entity';
import { User } from './modules/users/entities/user.entity';
import { Role } from './modules/roles/entities/role.entity';
import { Permission } from './modules/roles/entities/permission.entity';
import { UserRole } from './modules/roles/entities/user-role.entity';
import { Guest } from './modules/guests/entities/guest.entity';
import { RoomType } from './modules/rooms/entities/room-type.entity';
import { Room } from './modules/rooms/entities/room.entity';
import { Booking } from './modules/bookings/entities/booking.entity';
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
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
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
        ],
        // MVP bosqichida synchronize=true tez ishlab chiqish uchun ishlatiladi.
        // Production'ga chiqishdan oldin migration-based flow'ga o'tkaziladi (typeorm migration:generate).
        synchronize: config.get<string>('nodeEnv') !== 'production',
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
