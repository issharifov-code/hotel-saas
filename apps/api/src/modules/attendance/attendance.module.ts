import { Module } from '@nestjs/common';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { AttendanceService } from './attendance.service';
import { LeaveRequestsService } from './leave-requests.service';
import { AttendanceController } from './attendance.controller';
import { LeaveRequestsController } from './leave-requests.controller';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [
    RlsModule.forFeature([AttendanceRecord, LeaveRequest]),
    RolesModule,
    UsersModule,
  ],
  providers: [AttendanceService, LeaveRequestsService],
  controllers: [AttendanceController, LeaveRequestsController],
  exports: [AttendanceService],
})
export class AttendanceModule {}
