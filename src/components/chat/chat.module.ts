import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import {
  ChatMessage,
  ChatMessageSchema,
} from '../../schemas/Chat.message.model';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Member, MemberSchema } from '../../schemas/Member.model';
import { Participant, ParticipantSchema } from '../../schemas/Participant.model';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Participant.name, schema: ParticipantSchema },
    ]),
    AuthModule,
  ],
  providers: [ChatService, ChatResolver],
  exports: [ChatService],
})
export class ChatModule {}
