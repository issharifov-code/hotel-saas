import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosOutlet } from './entities/pos-outlet.entity';
import { MenuItem } from './entities/menu-item.entity';
import { PosOrder } from './entities/pos-order.entity';
import { PosOrderItem } from './entities/pos-order-item.entity';
import { PosOutletsService } from './pos-outlets.service';
import { MenuItemsService } from './menu-items.service';
import { PosOrdersService } from './pos-orders.service';
import { PosOutletsController } from './pos-outlets.controller';
import { MenuItemsController } from './menu-items.controller';
import { PosOrdersController } from './pos-orders.controller';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [TypeOrmModule.forFeature([PosOutlet, MenuItem, PosOrder, PosOrderItem]), RolesModule],
  providers: [PosOutletsService, MenuItemsService, PosOrdersService],
  controllers: [PosOutletsController, MenuItemsController, PosOrdersController],
  exports: [PosOutletsService],
})
export class PosModule {}
