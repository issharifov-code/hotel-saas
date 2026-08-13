import { ArrayNotEmpty, IsArray, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
