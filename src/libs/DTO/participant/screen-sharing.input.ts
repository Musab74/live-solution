import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MediaState } from '../../enums/enums';

@InputType()
export class ForceScreenShareInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field(() => MediaState)
  @IsEnum(MediaState)
  screenState!: MediaState;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  screenShareInfo?: string; // Name of screen/window being shared
}

@InputType()
export class UpdateScreenShareInfoInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  screenShareInfo?: string; // Screen/window name

  @Field(() => MediaState, { nullable: true })
  @IsOptional()
  @IsEnum(MediaState)
  screenState?: MediaState;
}

@InputType()
export class GetScreenShareStatusInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  participantId?: string; // If not provided, get all participants' screen status
}
