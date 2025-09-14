import { MeetingStatus } from "src/libs/enums/enums";

export class MeetingDto {
  id!: string;
  title!: string;
  status!: MeetingStatus;
  inviteCode!: string;          // 초대코드
  passcode?: string;
  hostId!: string;
  scheduledStartAt?: string;    // ISO (예약된 회의)
  actualStartAt?: string;       // ISO (시작된 회의)
  endedAt?: string;             // ISO (종료된 회의)
  durationMin?: number;
  notes?: string;
  participantCount?: number;
  createdAt!: string;
  updatedAt!: string;
}
