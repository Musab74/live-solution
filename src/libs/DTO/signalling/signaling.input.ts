import { IsIn, IsOptional, IsString, IsEnum } from 'class-validator';
import { MediaState } from 'src/libs/enums/enums';

export class JoinRoomWsInput {
  @IsString() roomId!: string;
  @IsOptional() @IsString() displayName?: string;
}

export class LeaveRoomWsInput {
  @IsString() roomId!: string;
}

export class SignalInput {
  @IsString() to!: string; // socket/peer id
  @IsIn(['offer', 'answer', 'candidate'])
  type!: 'offer' | 'answer' | 'candidate';
  @IsOptional() sdp?: string;
  @IsOptional() candidate?: any;
}

/**
 * NEW:
 * - Self updates: client sets its own mic/camera.
 * - Moderator updates: host/admin sets target's mic/camera to forced states.
 * Server should authorize (only HOST/CO_HOST/ADMIN can set forced states).
 */
export class MediaStateChangeInput {
  @IsString() roomId!: string;

  // Optional: when host/admin controls someone else
  @IsOptional()
  @IsString()
  targetPeerId?: string;

  // Either field can be provided; both optional to allow partial patch
  @IsOptional()
  @IsEnum(MediaState)
  mic?: MediaState; // use MUTED_BY_HOST for forced mute

  @IsOptional()
  @IsEnum(MediaState)
  camera?: MediaState; // use OFF_BY_ADMIN for forced camera off
}
