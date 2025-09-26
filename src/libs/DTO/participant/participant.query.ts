import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class SessionInfo {
  @Field()
  joinedAt: Date;

  @Field({ nullable: true })
  leftAt?: Date;

  @Field()
  durationMinutes: number;
}

@ObjectType()
export class LoginInfo {
  @Field()
  totalSessions: number;

  @Field({ nullable: true })
  firstLogin?: Date;

  @Field({ nullable: true })
  lastLogin?: Date;

  @Field()
  totalDurationMinutes: number;

  @Field()
  isCurrentlyOnline: boolean;

  @Field(() => [SessionInfo])
  sessions: SessionInfo[];
}

@ObjectType()
export class ParticipantUserInfo {
  @Field(() => ID)
  _id: string;

  @Field()
  email: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  organization?: string;

  @Field({ nullable: true })
  department?: string;
}

@ObjectType()
export class ParticipantWithLoginInfo {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  meetingId: string;

  @Field(() => ParticipantUserInfo, { nullable: true })
  user?: ParticipantUserInfo;

  @Field()
  displayName: string;

  @Field()
  role: string;

  @Field()
  status: string; // 🔧 FIX: Add status field for frontend filtering

  @Field()
  micState: string;

  @Field()
  cameraState: string;

  @Field({ nullable: true })
  socketId?: string;

  @Field(() => LoginInfo)
  loginInfo: LoginInfo;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ParticipantStats {
  @Field()
  totalParticipants: number;

  @Field()
  currentlyOnline: number;

  @Field()
  totalSessions: number;

  @Field()
  averageSessionDuration: number;

  @Field()
  totalMeetingDuration: number;

  // Additional fields for frontend compatibility
  @Field()
  activeParticipants: number;

  @Field()
  mutedParticipants: number;

  @Field()
  cameraOffParticipants: number;

  @Field()
  raisedHandsCount: number;

  @Field()
  screenSharersCount: number;
}

@ObjectType()
export class JoinMeetingResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => ParticipantWithLoginInfo, { nullable: true })
  participant?: ParticipantWithLoginInfo;
}
