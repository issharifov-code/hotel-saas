import { IsEnum } from 'class-validator';
import { SalaryType } from '../entities/user.entity';
import { IsMoneyString } from '../../../common/validators/numeric-string.validator';

export class SetSalaryDto {
  @IsEnum(SalaryType)
  salaryType: SalaryType;

  @IsMoneyString('salaryAmount')
  salaryAmount: string;
}
