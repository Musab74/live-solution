import { IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ParticipantCreateInput {
  @IsString() meetingId!: string;
  @IsString() userId!: string;
  @IsOptional() @IsString() displayName?: string;
}

export class ParticipantSummaryInput {
  @IsString() meetingId!: string;
  @IsString() userId!: string;
  @IsISO8601() joinedAt!: string;
  @IsInt() @Min(0) durationSec!: number;
}
