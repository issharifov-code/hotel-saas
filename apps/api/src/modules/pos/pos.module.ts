import { Module } from '@nestjs/common';
import { PosOutlet } from './entities/pos-outlet.entity';
import { MenuItem } from './entities/menu-item.entity';
import { PosOrder } from './entities/pos-order.entity';
import { PosOrderItem } from './entities/pos-order-item.entity';
import { Property } from '../properties/entities/property.entity';
import { PosOutletsService } from './pos-outlets.service';
import { MenuItemsService } from './menu-items.service';
import { PosOrdersService } from './pos-orders.service';
import { PosOutletsController } from './pos-outlets.controller';
import { MenuItemsController } from './menu-items.controller';
import { PosOrdersController } from './pos-orders.controller';
import { RolesModule } from '../roles/roles.module';
import { InvoicingModule } from '../invoicing/invoicing.module';
import { RlsModule } from '../../common/rls/rls.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    // `Property` — buyurtma valyutasi mulkdan olinadi (audit №12).
    RlsModule.forFeature([PosOutlet, MenuItem, PosOrder, PosOrderItem, Property]),
    RolesModule,
    InvoicingModule,
    AccountingModule,
  ],
  providers: [PosOutletsService, MenuItemsService, PosOrdersService],
  controllers: [PosOutletsController, MenuItemsController, PosOrdersController],
  exports: [PosOutletsService],
})
export class PosModule {}
