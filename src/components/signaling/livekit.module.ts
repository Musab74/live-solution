import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LivekitService } from './livekit.service';
import { LivekitResolver } from './livekit.resolver';
import { AuthModule } from '../auth/auth.module';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Participant, ParticipantSchema } from '../../schemas/Participant.model';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: Participant.name, schema: ParticipantSchema },
    ]),
  ],
  providers: [LivekitService, LivekitResolver],
  exports: [LivekitService],
})
export class LivekitModule {}
