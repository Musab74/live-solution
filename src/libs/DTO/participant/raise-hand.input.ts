import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

@InputType()
export class RaiseHandInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string; // Optional reason for raising hand
}

@InputType()
export class LowerHandInput {
  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string; // Optional reason for lowering hand
}

@InputType()
export class HostLowerHandInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field(() => ID)
  @IsString()
  participantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string; // Reason for host lowering hand
}

@InputType()
export class GetRaisedHandsInput {
  @Field(() => ID)
  @IsString()
  meetingId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeLowered?: boolean; // Include recently lowered hands
}
