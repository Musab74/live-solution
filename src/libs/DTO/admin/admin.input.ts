import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SystemRole } from 'src/libs/enums/enums';

// change a user's system role (e.g., MEMBER -> ADMIN, or back)
export class AdminChangeMemberSystemRoleInput {
  @IsString() memberId!: string;
  @IsEnum(SystemRole) role!: SystemRole;
  @IsOptional() @IsString() reason?: string;
}

// end ANY meeting (even if not the host)
export class AdminEndMeetingInput {
  @IsString() meetingId!: string;
  @IsOptional() @IsString() reason?: string;
}

// update a scheduled meeting (force-edit)
export class AdminUpdateScheduledMeetingInput {
  @IsString() meetingId!: string;
  // reuse fields from your normal UpdateMeetingInput,
  // but keep all optional so admin can patch any subset
  @IsOptional() title?: string;
  @IsOptional() startAt?: string; // ISO
  @IsOptional() durationMin?: number;
  @IsOptional() passcode?: string;
  @IsOptional() notes?: string;
}
