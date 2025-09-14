export class AdminAuditDto {
    id!: string;
    adminId!: string;
    action!: string;        // e.g., 'ROLE_CHANGE', 'MEETING_END', 'MEETING_UPDATE'
    targetId!: string;      // memberId or meetingId
    metadata?: Record<string, any>;
    createdAt!: string;     // ISO
  }
  