import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class CanUseWhiteboardInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;
}

@InputType()
export class StartWhiteboardInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;
}

@InputType()
export class StopWhiteboardInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;
}

