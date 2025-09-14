import { IsOptional, IsString } from 'class-validator';

export class UpdateMemberInput {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() timezone?: string;
}
