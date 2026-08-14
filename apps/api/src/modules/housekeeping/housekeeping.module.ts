import { Module } from '@nestjs/common';
import { HousekeepingTask } from './entities/housekeeping-task.entity';
import { Room } from '../rooms/entities/room.entity';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingController } from './housekeeping.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [RlsModule.forFeature([HousekeepingTask, Room]), RolesModule],
  providers: [HousekeepingService],
  controllers: [HousekeepingController],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
