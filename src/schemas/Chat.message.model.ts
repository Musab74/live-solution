import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Schema({ timestamps: true })
@ObjectType()
export class ChatMessage {
  @Field(() => ID)
  _id!: string;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId!: Types.ObjectId;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Member', index: true })
  userId?: Types.ObjectId;

  @Field()
  @Prop({ required: true, trim: true })
  displayName!: string;

  @Field()
  @Prop({ required: true, trim: true })
  text!: string;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'ChatMessage' })
  replyToMessageId?: Types.ObjectId;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ meetingId: 1, createdAt: 1 });
ChatMessageSchema.index({ text: 'text' }); // text search
