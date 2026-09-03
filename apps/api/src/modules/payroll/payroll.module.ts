import { Module } from '@nestjs/common';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayslipEntry } from './entities/payslip-entry.entity';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { RlsModule } from '../../common/rls/rls.module';

@Module({
  imports: [
    RlsModule.forFeature([PayrollRun, PayslipEntry]),
    RolesModule,
    UsersModule,
    AccountingModule,
    AttendanceModule,
  ],
  providers: [PayrollService],
  controllers: [PayrollController],
  exports: [PayrollService],
})
export class PayrollModule {}
