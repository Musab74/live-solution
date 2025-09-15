import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Field, InputType, ID } from '@nestjs/graphql';
import { ParticipantStatus } from '../../enums/enums';

@InputType()
export class DeviceTestInput {
  @Field()
  @IsString()
  deviceType!: string; // 'camera' | 'microphone' | 'speaker'

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deviceId?: string; // Specific device ID to test
}

@InputType()
export class PreMeetingSetupInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field()
  @IsString()
  displayName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  inviteCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  joinWithCameraOff?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  joinWithMicOff?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  joinWithSpeakerOff?: boolean;
}

@InputType()
export class ApproveParticipantInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  message?: string;
}

@InputType()
export class RejectParticipantInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class AdmitParticipantInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  message?: string;
}
