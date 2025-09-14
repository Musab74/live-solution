export class InviteDto {
    meetingId!: string;
    inviteCode!: string;
    sentTo!: string[]; // emails
    createdAt!: string;
  }
  