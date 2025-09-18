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
