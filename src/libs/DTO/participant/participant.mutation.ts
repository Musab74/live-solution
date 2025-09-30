import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Field, InputType, ID, ObjectType } from '@nestjs/graphql';
import {
  Role,
  MediaState,
  MediaTrack,
  ParticipantStatus,
} from '../../enums/enums';
import { Session } from '../../../schemas/Participant.model';

@InputType()
export class CreateParticipantInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field()
  @IsString()
  displayName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

@InputType()
export class UpdateParticipantInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  displayName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(MediaState)
  micState?: MediaState;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(MediaState)
  cameraState?: MediaState;
}

@InputType()
export class JoinParticipantInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field()
  @IsString()
  displayName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  inviteCode?: string;
}

@InputType()
export class LeaveMeetingInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;
}

@InputType()
export class UpdateSessionInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field()
  @IsString()
  action!: string; // 'join' or 'leave'
}

@InputType()
export class ForceMediaInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class ForceMuteInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field(() => MediaTrack, { defaultValue: MediaTrack.MIC })
  @IsEnum(MediaTrack)
  track!: MediaTrack;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class ForceCameraOffInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class TransferHostInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field(() => ID)
  @IsString()
  newHostParticipantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@ObjectType()
export class ParticipantResponse {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  meetingId: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field()
  displayName: string;

  @Field()
  role: string;

  @Field()
  micState: string;

  @Field()
  cameraState: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  socketId?: string;

  @Field(() => [Session])
  sessions: Session[];

  @Field()
  totalDurationSec: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class RemovedParticipantInfo {
  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID)
  meetingId: string;

  @Field()
  displayName: string;
}

@ObjectType()
export class ParticipantMessageResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  // add this
  @Field(() => ID, { nullable: true })
  newHostId?: string;

  @Field(() => ID, { nullable: true })
  newHostParticipantId?: string;

  @Field(() => RemovedParticipantInfo, { nullable: true })
  removedParticipant?: RemovedParticipantInfo;
}

