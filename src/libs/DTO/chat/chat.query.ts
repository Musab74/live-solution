import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class ChatUserInfo {
  @Field(() => ID)
  _id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}

@ObjectType()
export class ReplyInfo {
  @Field(() => ID)
  _id: string;

  @Field()
  text: string;

  @Field()
  displayName: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class ChatMessageWithDetails {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  meetingId: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field()
  displayName: string;

  @Field()
  text: string;

  @Field(() => ID, { nullable: true })
  replyToMessageId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ChatUserInfo, { nullable: true })
  user?: ChatUserInfo;

  @Field(() => ReplyInfo, { nullable: true })
  replyToMessage?: ReplyInfo;
}

@ObjectType()
export class ChatHistoryResponse {
  @Field(() => [ChatMessageWithDetails])
  messages: ChatMessageWithDetails[];

  @Field()
  hasMore: boolean;

  @Field()
  total: number;

  @Field()
  limit: number;

  @Field({ nullable: true })
  nextCursor?: string;
}

@ObjectType()
export class ChatSearchResponse {
  @Field(() => [ChatMessageWithDetails])
  messages: ChatMessageWithDetails[];

  @Field()
  total: number;

  @Field()
  limit: number;

  @Field()
  offset: number;

  @Field()
  hasMore: boolean;

  @Field()
  query: string;
}

@ObjectType()
export class ChatStats {
  @Field()
  totalMessages: number;

  @Field()
  messagesToday: number;

  @Field()
  activeUsers: number;

  @Field()
  averageMessagesPerUser: number;
}

@ObjectType()
export class ChatMessageResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => ID, { nullable: true })
  messageId?: string;
}