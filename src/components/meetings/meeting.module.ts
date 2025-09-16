import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetingService } from './meeting.service';
import { MeetingResolver } from './meeting.resolver';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Member, MemberSchema } from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    AuthModule,
  ],
  providers: [MeetingService, MeetingResolver],
  exports: [MeetingService],
})
export class MeetingModule {}
