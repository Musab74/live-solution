import { ObjectType, Field, ID } from '@nestjs/graphql';
import { VodSourceType } from '../../enums/enums';

@ObjectType()
export class MeetingInfo {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  status: string;

  @Field()
  inviteCode: string;
}

@ObjectType()
export class VodWithMeeting {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field(() => ID, { nullable: true })
  meetingId?: string;

  @Field()
  source: string;

  @Field({ nullable: true })
  storageKey?: string;

  @Field({ nullable: true })
  sizeBytes?: number;

  @Field({ nullable: true })
  url?: string;

  @Field({ nullable: true })
  durationSec?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => MeetingInfo, { nullable: true })
  meeting?: MeetingInfo;
}

@ObjectType()
export class VodListResponse {
  @Field(() => [VodWithMeeting])
  vods: VodWithMeeting[];

  @Field()
  total: number;

  @Field()
  limit: number;

  @Field()
  offset: number;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class VodStats {
  @Field()
  totalVods: number;

  @Field()
  fileVods: number;

  @Field()
  urlVods: number;

  @Field()
  totalSizeBytes: number;

  @Field()
  averageDuration: number;
}

@ObjectType()
export class VodUploadResponse {
  @Field(() => ID)
  vodId: string;

  @Field()
  title: string;

  @Field()
  storageKey: string;

  @Field()
  sizeBytes: number;

  @Field()
  message: string;
}

@ObjectType()
export class VodUrlResponse {
  @Field(() => ID)
  vodId: string;

  @Field()
  title: string;

  @Field()
  url: string;

  @Field()
  message: string;
}