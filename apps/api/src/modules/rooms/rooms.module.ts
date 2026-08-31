import { Module } from '@nestjs/common';
import { RoomType } from './entities/room-type.entity';
import { Room } from './entities/room.entity';
import { RatePlan } from './entities/rate-plan.entity';
import { RatePlanRestriction } from './entities/rate-plan-restriction.entity';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';
import { RatePlansService } from './rate-plans.service';
import { RatePlanRestrictionsService } from './rate-plan-restrictions.service';
import { RoomsController } from './rooms.controller';
import { RolesModule } from '../roles/roles.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [
    RlsModule.forFeature([RoomType, Room, RatePlan, RatePlanRestriction]),
    RolesModule,
  ],
  providers: [
    RoomTypesService,
    RoomsService,
    RatePlansService,
    RatePlanRestrictionsService,
  ],
  controllers: [RoomsController],
  exports: [
    RoomTypesService,
    RoomsService,
    RatePlansService,
    RatePlanRestrictionsService,
  ],
})
export class RoomsModule {}
