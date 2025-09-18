import { IsOptional, IsString, IsBoolean, IsDateString, IsInt, Min, MaxLength } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateMeetingInput {
  @Field()
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  scheduledFor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;
}

@InputType()
export class UpdateMeetingInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  scheduledFor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;
}

@InputType()
export class JoinMeetingInput {
  @Field()
  @IsString()
  inviteCode!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  passcode?: string;
}

@InputType()
export class RotateInviteCodeInput {
  @Field()
  @IsString()
  meetingId!: string;
}

@InputType()
export class StartMeetingInput {
  @Field()
  @IsString()
  meetingId!: string;
}

@InputType()
export class EndMeetingInput {
  @Field()
  @IsString()
  meetingId!: string;
}

@InputType()
export class MeetingQueryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  hostId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
