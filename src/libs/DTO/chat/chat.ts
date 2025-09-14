export class ChatMessageDto {
    id!: string;
    meetingId!: string;
    userId!: string;
    displayName!: string;
    text!: string;
    createdAt!: string; // ISO
    replyToMessageId?: string;
  }
  