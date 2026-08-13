import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  password: string;

  @IsString()
  @MinLength(2)
  fullName: string;
}
