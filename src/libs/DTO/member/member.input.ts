import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class MemberInput {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
  @IsString() displayName!: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() phone?: string;
}
