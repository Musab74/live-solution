import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class ChatMessageDto {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  meetingId!: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field()
  displayName!: string;

  @Field()
  text!: string;

  @Field(() => ID, { nullable: true })
  replyToMessageId?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
