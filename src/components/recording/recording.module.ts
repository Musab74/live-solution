import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordingService } from './recording.service';
import { RecordingResolver } from './recording.resolver';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Member, MemberSchema } from '../../schemas/Member.model';
import { Vod, VodSchema } from '../../schemas/Vod.model';
import { AuthModule } from '../auth/auth.module';
import { LivekitService } from '../signaling/livekit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Vod.name, schema: VodSchema },
    ]),
    AuthModule,
  ],
  providers: [RecordingService, RecordingResolver, LivekitService],
  exports: [RecordingService],
})
export class RecordingModule {}
