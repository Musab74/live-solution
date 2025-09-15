import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VodService } from './vod.service';
import { VodResolver } from './vod.resolver';
import { Vod, VodSchema } from '../../schemas/Vod.model';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Member, MemberSchema } from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vod.name, schema: VodSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    AuthModule,
  ],
  providers: [VodService, VodResolver],
  exports: [VodService],
})
export class VodModule {}
