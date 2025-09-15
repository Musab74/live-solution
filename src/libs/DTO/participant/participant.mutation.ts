import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Field, InputType, ID, ObjectType } from '@nestjs/graphql';
import { Role, MediaState } from '../../enums/enums';

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
export class JoinMeetingInput {
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

  @Field({ nullable: true })
  socketId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ParticipantMessageResponse {
  @Field()
  message: string;

  @Field({ nullable: true })
  success?: boolean;
}
