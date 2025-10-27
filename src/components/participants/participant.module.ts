import { Module, forwardRef } from '@nestjs/common';
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
import { MeetingModule } from '../meetings/meeting.module';
import { LivekitModule } from '../signaling/livekit.module';
import { SignalingModule } from '../signaling/signaling.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Participant.name, schema: ParticipantSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    AuthModule,
    forwardRef(() => MeetingModule),
    LivekitModule, // Import LiveKit module instead of duplicating service
    forwardRef(() => SignalingModule), // ✅ Import signaling module for WebSocket
  ],
  providers: [ParticipantService, ParticipantResolver],
  exports: [ParticipantService],
})
export class ParticipantModule {}
