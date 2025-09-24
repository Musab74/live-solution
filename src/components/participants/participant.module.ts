import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParticipantService } from './participant.service';
import { ParticipantResolver } from './participant.resolver';
import {
  Participant,
  ParticipantSchema,
} from '../../schemas/Participant.model';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Member, MemberSchema } from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';
import { LivekitService } from '../signaling/livekit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Participant.name, schema: ParticipantSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    AuthModule,
  ],
  providers: [ParticipantService, ParticipantResolver, LivekitService],
  exports: [ParticipantService],
})
export class ParticipantModule {}
