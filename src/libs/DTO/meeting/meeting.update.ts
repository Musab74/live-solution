import { IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMeetingInput {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsISO8601() startAt?: string;
  @IsOptional() @IsInt() @Min(5) durationMin?: number;
  @IsOptional() @IsString() passcode?: string;
  @IsOptional() @IsString() notes?: string;
}
