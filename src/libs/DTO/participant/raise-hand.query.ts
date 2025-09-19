import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class HandRaiseInfo {
  @Field(() => ID)
  participantId!: string;

  @Field()
  displayName!: string;

  @Field()
  hasHandRaised!: boolean;

  @Field({ nullable: true })
  handRaisedAt?: Date;

  @Field({ nullable: true })
  handLoweredAt?: Date;

  @Field({ nullable: true })
  handRaiseDuration?: number; // Duration in seconds

  @Field({ nullable: true })
  reason?: string; // Reason for raising hand

  @Field()
  isWaitingForResponse!: boolean; // True if hand is still raised
}

@ObjectType()
export class RaisedHandsResponse {
  @Field(() => [HandRaiseInfo])
  raisedHands!: HandRaiseInfo[];

  @Field()
  totalRaisedHands!: number;

  @Field()
  meetingId!: string;

  @Field()
  timestamp!: Date;
}

@ObjectType()
export class HandRaiseActionResponse {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field(() => ID)
  participantId!: string;

  @Field()
  hasHandRaised!: boolean;

  @Field({ nullable: true })
  handRaisedAt?: Date;

  @Field({ nullable: true })
  handLoweredAt?: Date;

  @Field({ nullable: true })
  reason?: string;
}
