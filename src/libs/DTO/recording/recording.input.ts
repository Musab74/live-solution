import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { RecordingStatus } from '../../enums/enums';

@InputType()
export class StartMeetingRecordingInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  quality?: string; // '720p', '1080p', '4k'

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  format?: string; // 'mp4', 'webm'
}

@InputType()
export class StopMeetingRecordingInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class PauseMeetingRecordingInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class ResumeRecordingInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class GetRecordingInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;
}
