import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookController } from './webhook.controller';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { LivekitService } from '../signaling/livekit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
    ]),
  ],
  controllers: [WebhookController],
  providers: [LivekitService],
})
export class WebhookModule {}
