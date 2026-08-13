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
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
