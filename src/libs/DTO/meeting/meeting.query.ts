import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Session } from '../../../schemas/Participant.model';
import { MeetingStatus } from '../../enums/enums';

@ObjectType()
export class HostInfo {
  @Field(() => ID)
  _id: string;

  @Field()
  email: string;

  @Field()
  displayName: string;

  @Field()
  systemRole: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  organization?: string;

  @Field({ nullable: true })
  department?: string;
}

@ObjectType()
export class MeetingWithHost {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  status: string;

  @Field(() => ID)
  hostId: string; // Original tutor/creator (never changes)

  @Field(() => ID, { nullable: true })
  currentHostId?: string; // Current host for meeting management (can change)

  @Field({ nullable: true })
  inviteCode?: string;

  @Field({ nullable: true })
  courseCode?: string;

  @Field({ nullable: true })
  isPrivate?: boolean;

  @Field({ nullable: true })
  isLocked?: boolean;

  @Field({ nullable: true })
  scheduledFor?: Date;

  @Field({ nullable: true })
  actualStartAt?: Date;

  @Field({ nullable: true })
  endedAt?: Date;

  @Field({ nullable: true })
  durationMin?: number;

  @Field({ nullable: true })
  duration?: number;

  @Field({ nullable: true })
  maxParticipants?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  participantCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => HostInfo, { nullable: true })
  host?: HostInfo;
}

@ObjectType()
export class MeetingStats {
  @Field()
  totalMeetings: number;

  @Field()
  activeMeetings: number;

  @Field()
  scheduledMeetings: number;

  @Field()
  completedMeetings: number;

  @Field()
  totalParticipants: number;

  @Field()
  averageMeetingDuration: number;
}

@ObjectType()
export class MeetingListResponse {
  @Field(() => [MeetingWithHost])
  meetings: MeetingWithHost[];

  @Field()
  total: number;

  @Field()
  page: number;

  @Field()
  limit: number;

  @Field()
  offset: number;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class InviteCodeResponse {
  @Field()
  inviteCode: string;

  @Field()
  message: string;
}

@ObjectType()
export class MeetingJoinResponse {
  @Field(() => ID)
  meetingId: string;

  @Field()
  title: string;

  @Field()
  status: string;

  @Field()
  inviteCode: string;

  @Field()
  message: string;
}

@ObjectType()
export class ParticipantAttendance {
  @Field()
  _id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  systemRole?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  organization?: string;

  @Field({ nullable: true })
  department?: string;

@Field({ nullable: true })
ipAddress?: string;

  @Field()
  role: string;

  @Field()
  joinedAt: string;

  @Field({ nullable: true })
  leftAt?: string;

  @Field()
  totalTime: number;

  @Field()
  sessionCount: number;

  @Field()
  isCurrentlyOnline: boolean;

  @Field()
  status: string;

  @Field()
  micState: string;

  @Field()
  cameraState: string;

  @Field()
  hasHandRaised: boolean;

  @Field({ nullable: true })
  handRaisedAt?: string;

  @Field({ nullable: true })
  handLoweredAt?: string;

  @Field(() => [Session])
  sessions: Session[];
}

@ObjectType()
export class MeetingResponse {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  status: string;

  @Field()
  inviteCode: string;

  @Field()
  isPrivate: boolean;

  @Field()
  isLocked: boolean;

  @Field({ nullable: true })
  scheduledFor?: string;

  @Field({ nullable: true })
  actualStartAt?: string;

  @Field({ nullable: true })
  endedAt?: string;

  @Field({ nullable: true })
  durationMin?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  participantCount: number;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  @Field()
  hostId: string;

  @Field(() => HostInfo, { nullable: true })
  host?: HostInfo;
}

@ObjectType()
export class MeetingAttendance {
  @Field()
  meetingId: string;

  @Field()
  totalParticipants: number;

  @Field()
  presentParticipants: number;

  @Field()
  absentParticipants: number;

  @Field()
  averageAttendanceTime: number;

  @Field()
  attendanceRate: number;

  @Field(() => [ParticipantAttendance])
  participants: ParticipantAttendance[];
}
