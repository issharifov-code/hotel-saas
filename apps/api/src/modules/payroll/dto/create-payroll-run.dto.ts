import { IsInt, Max, Min } from 'class-validator';

export class CreatePayrollRunDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  periodYear: number;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;
}
