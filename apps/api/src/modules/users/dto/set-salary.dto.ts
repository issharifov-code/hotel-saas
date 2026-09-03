import { IsEnum, IsNumberString } from 'class-validator';
import { SalaryType } from '../entities/user.entity';

export class SetSalaryDto {
  @IsEnum(SalaryType)
  salaryType: SalaryType;

  @IsNumberString()
  salaryAmount: string;
}
