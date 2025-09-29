import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LivekitService } from './livekit.service';
import { LivekitResolver } from './livekit.resolver';
import { SignalingGateway } from './signaling.gateway';
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../members/member.module';
import { ParticipantModule } from '../participants/participant.module';
import { ChatService } from '../../services/chat.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from '../../schemas/Chat.message.model';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Member, MemberSchema } from '../../schemas/Member.model';
import { Participant, ParticipantSchema } from '../../schemas/Participant.model';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Participant.name, schema: ParticipantSchema },
    ]),
    AuthModule,
    MemberModule,
    ParticipantModule,
  ],
  providers: [LivekitService, LivekitResolver, SignalingGateway, ChatService],
  exports: [LivekitService, SignalingGateway, ChatService],
})
export class SignalingModule {}
