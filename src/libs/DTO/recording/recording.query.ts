import { ObjectType, Field, ID, InputType } from '@nestjs/graphql';
import { RecordingStatus } from '../../enums/enums';
import { IsMongoId } from 'class-validator';

@ObjectType()
export class MeetingRecordingInfo {
  @Field(() => ID)
  meetingId!: string;

  @Field()
  isRecording!: boolean;

  @Field({ nullable: true })
  recordingId?: string;

  @Field({ nullable: true })
  recordingUrl?: string;

  @Field({ nullable: true })
  recordingStartedAt?: Date;

  @Field({ nullable: true })
  recordingEndedAt?: Date;

  @Field({ nullable: true })
  recordingPausedAt?: Date;

  @Field({ nullable: true })
  recordingResumedAt?: Date;

  @Field({ nullable: true })
  recordingDuration?: number;

  @Field(() => RecordingStatus, { nullable: true })
  recordingStatus?: RecordingStatus;

  @Field({ nullable: true })
  quality?: string;

  @Field({ nullable: true })
  format?: string;

  // Additional fields for frontend compatibility
  @Field(() => RecordingStatus, { nullable: true })
  status?: RecordingStatus; // Alias for recordingStatus

  @Field({ nullable: true })
  recordingType?: string; // e.g., "VIDEO", "AUDIO", "SCREEN"

  @Field({ nullable: true })
  startedAt?: Date; // Alias for recordingStartedAt

  @Field({ nullable: true })
  stoppedAt?: Date; // Alias for recordingEndedAt

  @Field({ nullable: true })
  pausedAt?: Date; // Alias for recordingPausedAt

  @Field({ nullable: true })
  resumedAt?: Date; // Alias for recordingResumedAt

  @Field({ nullable: true })
  durationSec?: number; // Alias for recordingDuration

  @Field({ nullable: true })
  fileSize?: number; // File size in bytes

  @Field({ nullable: true })
  downloadUrl?: string; // Direct download URL
}

@ObjectType()
export class RecordingResponse {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field(() => ID)
  meetingId!: string;

  @Field({ nullable: true })
  recordingId?: string;

  @Field({ nullable: true })
  recordingUrl?: string;

  @Field(() => MeetingRecordingInfo, { nullable: true })
  recording?: MeetingRecordingInfo;
}

@ObjectType()
export class RecordingStats {
  @Field()
  totalRecordings!: number;

  @Field()
  activeRecordings!: number;

  @Field()
  pausedRecordings!: number;

  @Field()
  totalRecordingTime!: number; // in seconds

  @Field()
  averageRecordingDuration!: number; // in seconds
}

@ObjectType()
export class RecordingInfo {
  @Field()
  meetingId: string;

  @Field()
  isRecording: boolean;

  @Field({ nullable: true })
  recordingId?: string;

  @Field({ nullable: true })
  recordingUrl?: string;

  @Field({ nullable: true })
  recordingStartedAt?: string;

  @Field({ nullable: true })
  recordingEndedAt?: string;

  @Field({ nullable: true })
  recordingPausedAt?: string;

  @Field({ nullable: true })
  recordingResumedAt?: string;

  @Field()
  recordingDuration: number;

  @Field()
  recordingStatus: string;

  @Field()
  quality: string;

  @Field()
  format: string;

  @Field()
  status: string;

  @Field()
  recordingType: string;

  @Field({ nullable: true })
  startedAt?: string;

  @Field({ nullable: true })
  stoppedAt?: string;

  @Field({ nullable: true })
  pausedAt?: string;

  @Field({ nullable: true })
  resumedAt?: string;

  @Field()
  durationSec: number;

  @Field()
  fileSize: number;

  @Field({ nullable: true })
  downloadUrl?: string;
}

@InputType()
export class GetRecordingQueryInput {
  @Field()
  @IsMongoId()
  meetingId: string;
}
