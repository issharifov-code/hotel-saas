import { Module } from '@nestjs/common';
import { CorporateAccount } from './entities/corporate-account.entity';
import { Invoice } from '../invoicing/entities/invoice.entity';
import { CityLedgerService } from './city-ledger.service';
import { CityLedgerController } from './city-ledger.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

// `Invoice` faqat entity sifatida ro'yxatdan o'tkaziladi (InvoicingModule
// emas) — GuestsModule/AgenciesModule'ning Invoice/Booking naqshiga o'xshab,
// aylanma bog'liqlikdan qochish uchun. Faqat hisob-varaq (statement)ni
// o'qish (getStatement) uchun kerak.
@Module({
  imports: [RlsModule.forFeature([CorporateAccount, Invoice]), RolesModule],
  providers: [CityLedgerService],
  controllers: [CityLedgerController],
  exports: [CityLedgerService],
})
export class CityLedgerModule {}
