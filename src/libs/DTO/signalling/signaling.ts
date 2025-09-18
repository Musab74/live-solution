import { MediaState } from 'src/libs/enums/enums';

export class PeerStateDto {
  peerId!: string;
  meetingId!: string;
  userId!: string;
  displayName!: string;
  camera!: MediaState; // ON | OFF | OFF_BY_ADMIN
  mic!: MediaState; // ON | OFF | MUTED | MUTED_BY_HOST
  joinedAt!: string; // ISO
}
