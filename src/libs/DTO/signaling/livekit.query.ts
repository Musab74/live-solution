import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class LivekitTokenResponse {
  @Field()
  token!: string;

  @Field()
  wsUrl!: string;

  @Field()
  roomName!: string;

  @Field()
  participantName!: string;

  @Field()
  participantId!: string;

  @Field()
  expiresAt!: Date;
}

@ObjectType()
export class RoomInfo {
  @Field()
  name!: string;

  @Field()
  numParticipants!: number;

  @Field()
  maxParticipants!: number;

  @Field()
  creationTime!: number;

  @Field()
  emptyTimeout!: number;

  @Field()
  isActive!: boolean;
}

@ObjectType()
export class ParticipantInfo {
  @Field()
  identity!: string;

  @Field()
  name!: string;

  @Field()
  joinedAt!: number;

  @Field()
  isPublisher!: boolean;

  @Field()
  isSubscriber!: boolean;

  @Field()
  isMuted!: boolean;

  @Field()
  isCameraEnabled!: boolean;

  @Field({ nullable: true })
  metadata?: string;
}

@ObjectType()
export class RoomStats {
  @Field()
  roomName!: string;

  @Field()
  participantCount!: number;

  @Field()
  isActive!: boolean;

  @Field()
  createdAt!: number;

  @Field()
  duration!: number;

  @Field(() => [ParticipantInfo])
  participants!: ParticipantInfo[];
}

@ObjectType()
export class RecordingInfo {
  @Field()
  sid!: string;

  @Field()
  roomName!: string;

  @Field()
  status!: string;

  @Field()
  startTime!: number;

  @Field({ nullable: true })
  endTime?: number;

  @Field()
  duration!: number;

  @Field()
  filePath!: string;

  @Field()
  fileSize!: number;
}

@ObjectType()
export class LivekitResponse {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field({ nullable: true })
  data?: string;
}
