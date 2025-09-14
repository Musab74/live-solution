import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member', index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ required: true, trim: true })
  text!: string;

  @Prop({ type: Types.ObjectId, ref: 'ChatMessage' })
  replyToMessageId?: Types.ObjectId;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ meetingId: 1, createdAt: 1 });
ChatMessageSchema.index({ text: 'text' }); // text search
