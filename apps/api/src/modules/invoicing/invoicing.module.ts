import { Module } from '@nestjs/common';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { InvoicePayment } from './entities/invoice-payment.entity';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [RlsModule.forFeature([Invoice, InvoiceLine, InvoicePayment]), RolesModule, AccountingModule],
  providers: [InvoicingService],
  controllers: [InvoicingController],
  exports: [InvoicingService],
})
export class InvoicingModule {}
