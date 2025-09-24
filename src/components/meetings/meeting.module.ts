import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetingService } from './meeting.service';
import { MeetingResolver } from './meeting.resolver';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Member, MemberSchema } from '../../schemas/Member.model';
import { Participant, ParticipantSchema } from '../../schemas/Participant.model';
import { AuthModule } from '../auth/auth.module';
import { LivekitService } from '../signaling/livekit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Participant.name, schema: ParticipantSchema },
    ]),
    AuthModule,
  ],
  providers: [MeetingService, MeetingResolver, LivekitService],
  exports: [MeetingService],
})
export class MeetingModule {}
