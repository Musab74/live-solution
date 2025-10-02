import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitter } from 'events';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './components/auth/auth.module';
import { MemberModule } from './components/members/member.module';
import { ParticipantModule } from './components/participants/participant.module';
import { MeetingModule } from './components/meetings/meeting.module';
import { VodModule } from './components/vod/vod.module';
import { SignalingModule } from './components/signaling/signaling.module';
import { HealthModule } from './components/health/health.module';
import { RecordingModule } from './components/recording/recording.module';
import { SocketModule } from './socket/socket.module';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Member, MemberSchema } from './schemas/Member.model';
import { Meeting, MeetingSchema } from './schemas/Meeting.model';
import { Participant, ParticipantSchema } from './schemas/Participant.model';
import { ChatMessage, ChatMessageSchema } from './schemas/Chat.message.model';
import { Invite, InviteSchema } from './schemas/Invite.model';
import { Vod, VodSchema } from './schemas/Vod.model';
import { PresenceCleanupService } from './services/presence-cleanup.service';

// Initialize global event emitter for meeting start notifications
const meetingStartEmitter = new EventEmitter();
(global as any).meetingStartEmitter = meetingStartEmitter;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      playground: true,
      introspection: true,
    }),
    DatabaseModule,
    AuthModule,
    MemberModule,
    ParticipantModule,
    MeetingModule,
    VodModule,
    SignalingModule,
    HealthModule,
    RecordingModule,
    SocketModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Participant.name, schema: ParticipantSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: Vod.name, schema: VodSchema },
    ]),
  ],
  providers: [PresenceCleanupService],
})
export class AppModule {}
