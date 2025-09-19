import { ObjectType, Field, ID } from '@nestjs/graphql';
import { MediaState } from '../../enums/enums';

@ObjectType()
export class ScreenShareInfo {
  @Field(() => ID)
  participantId!: string;

  @Field()
  displayName!: string;

  @Field(() => MediaState)
  screenState!: MediaState;

  @Field({ nullable: true })
  screenShareInfo?: string; // Name of screen/window being shared

  @Field({ nullable: true })
  screenShareStartedAt?: Date;

  @Field({ nullable: true })
  screenShareDuration?: number; // in seconds

  @Field()
  isCurrentlySharing!: boolean;
}

@ObjectType()
export class ScreenShareStatusResponse {
  @Field(() => [ScreenShareInfo])
  participants!: ScreenShareInfo[];

  @Field()
  totalParticipants!: number;

  @Field()
  currentlySharingCount!: number;

  @Field()
  meetingId!: string;
}

@ObjectType()
export class ScreenShareControlResponse {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field(() => ID, { nullable: true })
  participantId?: string;

  @Field(() => MediaState, { nullable: true })
  screenState?: MediaState;

  @Field({ nullable: true })
  screenShareInfo?: string;
}
