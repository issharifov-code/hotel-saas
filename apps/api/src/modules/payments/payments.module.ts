import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MockPaymentAdapter } from './adapters/mock-payment.adapter';
import { PAYMENT_ADAPTERS } from './interfaces/payment-gateway.interface';
import { InvoicingModule } from '../invoicing/invoicing.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  // RolesModule PaymentsController'dagi PermissionsGuard uchun zarur
  // (RolesService'ga bog'liqlik) — InvoicingModule uni export qilmagani
  // uchun bu yerda alohida import qilinishi shart.
  imports: [InvoicingModule, RolesModule],
  controllers: [PaymentsController],
  providers: [
    MockPaymentAdapter,
    {
      // Kelajakda yangi adapter (masalan PayeAdapter) qo'shilganda, uni shu
      // yerga (providers va useFactory massiviga) qo'shish kifoya.
      provide: PAYMENT_ADAPTERS,
      useFactory: (mock: MockPaymentAdapter) => [mock],
      inject: [MockPaymentAdapter],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
