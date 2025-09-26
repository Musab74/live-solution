import { IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ParticipantCreateInput {
  @Field()
  @IsString()
  meetingId!: string;

  @Field()
  @IsString()
  userId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  displayName?: string;
}

@InputType()
export class ParticipantSummaryInput {
  @Field()
  @IsString()
  meetingId!: string;

  @Field()
  @IsString()
  userId!: string;

  @Field()
  @IsISO8601()
  joinedAt!: string;

  @Field()
  @IsInt()
  @Min(0)
  durationSec!: number;
}

@InputType()
export class JoinMeetingParticipantInput {
  @Field()
  @IsString()
  meetingId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  displayName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  passcode?: string;
}

@InputType()
export class UpdateParticipantInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  displayName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  role?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  micState?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  cameraState?: string;
}

@InputType()
export class KickParticipantMeetingInput {
  @Field()
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
