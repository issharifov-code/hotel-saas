import { Module } from '@nestjs/common';
import { Guest } from './entities/guest.entity';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [RlsModule.forFeature([Guest]), RolesModule],
  providers: [GuestsService],
  controllers: [GuestsController],
  exports: [GuestsService],
})
export class GuestsModule {}
