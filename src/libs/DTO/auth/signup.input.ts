import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupInput {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
  @IsString() displayName!: string;
  @IsOptional() @IsString() organization?: string;
  @IsOptional() @IsString() phone?: string;
}
