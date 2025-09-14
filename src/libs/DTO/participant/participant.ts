import { MediaState, Role } from "src/libs/enums/enums";

export class ParticipantDto {
  id!: string;
  meetingId!: string;
  userId!: string;
  displayName!: string;
  role!: Role;

  // NEW: live media states (reflect forced states too)
  micState!: MediaState;        // ON | OFF | MUTED | MUTED_BY_HOST
  cameraState!: MediaState;     // ON | OFF | OFF_BY_ADMIN

  joinedAt?: string;            // ISO
  leftAt?: string;              // ISO
  totalDurationSec?: number;
}
