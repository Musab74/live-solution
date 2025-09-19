import { ObjectType, Field, ID } from '@nestjs/graphql';
import { RecordingStatus } from '../../enums/enums';

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
