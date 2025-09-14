import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInstantMeetingInput {
  @IsString() title!: string;                 // 방 만들기
  @IsOptional() @IsBoolean() isPrivate?: boolean = false;
  @IsOptional() @IsString() passcode?: string;
}

export class ScheduleMeetingInput {
  @IsString() title!: string;                 // 예약하기
  @IsISO8601() startAt!: string;              // ISO
  @IsOptional() @IsInt() @Min(5) durationMin?: number = 60;
  @IsOptional() @IsString({ each: true }) invitees?: string[]; // emails or userIds
  @IsOptional() @IsString() passcode?: string;
  @IsOptional() @IsString() notes?: string;   // 비고
}

export class JoinByCodeInput {
  @IsString() inviteCode!: string;            // 입장하기
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() passcode?: string;
}

export class EndMeetingInput {
  @IsOptional() @IsString() reason?: string;
}
