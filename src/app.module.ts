import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './components/auth/auth.module';
import { MemberModule } from './components/members/member.module';
import { ParticipantModule } from './components/participants/participant.module';
import { MeetingModule } from './components/rooms/meeting.module';
import { VodModule } from './components/vod/vod.module';
import { ChatModule } from './components/chat/chat.module';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Member, MemberSchema } from './schemas/Member.model';
import { Meeting, MeetingSchema } from './schemas/Meeting.model';
import { Participant, ParticipantSchema } from './schemas/Participant.model';
import { ChatMessage, ChatMessageSchema } from './schemas/Chat.message.model';
import { Invite, InviteSchema } from './schemas/Invite.model';
import { Vod, VodSchema } from './schemas/Vod.model';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      introspection: true,
    }),
    DatabaseModule,
    AuthModule,
    MemberModule,
    ParticipantModule,
    MeetingModule,
    VodModule,
    ChatModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Participant.name, schema: ParticipantSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: Vod.name, schema: VodSchema },
    ]),
  ],
})
export class AppModule {}
