import { IsOptional, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID('4')
  userId: string;

  @IsUUID('4')
  roleId: string;

  @IsOptional()
  @IsUUID('4')
  propertyId?: string;
}
