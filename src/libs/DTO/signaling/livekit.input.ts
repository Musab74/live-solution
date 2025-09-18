import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class GenerateTokenInput {
  @Field()
  @IsString()
  roomName!: string;

  @Field()
  @IsString()
  participantName!: string;

  @Field()
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canSubscribe?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canPublishData?: boolean;
}

@InputType()
export class CreateRoomInput {
  @Field()
  @IsString()
  roomName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxParticipants?: number;
}

@InputType()
export class MuteParticipantInput {
  @Field()
  @IsString()
  roomName!: string;

  @Field()
  @IsString()
  participantId!: string;

  @Field()
  @IsString()
  trackSid!: string;

  @Field()
  @IsBoolean()
  muted!: boolean;
}

@InputType()
export class KickParticipantInput {
  @Field()
  @IsString()
  roomName!: string;

  @Field()
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class UpdateParticipantMetadataInput {
  @Field()
  @IsString()
  roomName!: string;

  @Field()
  @IsString()
  participantId!: string;

  @Field()
  @IsString()
  metadata!: string;
}

@InputType()
export class StartRecordingInput {
  @Field()
  @IsString()
  roomName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  outputPath?: string;
}

@InputType()
export class StopRecordingInput {
  @Field()
  @IsString()
  recordingSid!: string;
}
