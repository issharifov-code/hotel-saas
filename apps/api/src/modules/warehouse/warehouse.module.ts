import { Module } from '@nestjs/common';
import { Warehouse } from './entities/warehouse.entity';
import { Supplier } from './entities/supplier.entity';
import { StockItem } from './entities/stock-item.entity';
import { StockLot } from './entities/stock-lot.entity';
import { StockTransaction } from './entities/stock-transaction.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { WarehousesService } from './warehouses.service';
import { SuppliersService } from './suppliers.service';
import { StockItemsService } from './stock-items.service';
import { StockService } from './stock.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SuppliersController } from './suppliers.controller';
import { StockItemsController } from './stock-items.controller';
import { WarehouseStockController } from './warehouse-stock.controller';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [
    RlsModule.forFeature([
      Warehouse,
      Supplier,
      StockItem,
      StockLot,
      StockTransaction,
      PurchaseOrder,
      PurchaseOrderItem,
    ]),
    RolesModule,
  ],
  providers: [WarehousesService, SuppliersService, StockItemsService, StockService, PurchaseOrdersService],
  controllers: [SuppliersController, StockItemsController, WarehouseStockController, PurchaseOrdersController],
  exports: [WarehousesService, StockService],
})
export class WarehouseModule {}
