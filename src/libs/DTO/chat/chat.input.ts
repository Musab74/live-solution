import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendChatInput {
  @IsString() meetingId!: string;
  @IsString() @MaxLength(2000) text!: string;
  @IsOptional() @IsString() replyToMessageId?: string;
}
