import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting } from '../../schemas/Meeting.model';
import { LivekitService } from '../signaling/livekit.service';

interface EgressWebhookPayload {
  egressId: string;
  roomName: string;
  status: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  file?: {
    filename: string;
    size: number;
    location: string;
  };
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<Meeting>,
    private readonly livekitService: LivekitService,
  ) {}

  @Post('egress')
  @HttpCode(HttpStatus.OK)
  async handleEgressWebhook(@Body() payload: EgressWebhookPayload) {
    try {
      this.logger.log(`[EGRESS_WEBHOOK] Received egress update:`, {
        egressId: payload.egressId,
        roomName: payload.roomName,
        status: payload.status,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        error: payload.error,
        file: payload.file,
      });

      // Find meeting by room name (meeting ID)
      const meeting = await this.meetingModel.findOne({
        _id: payload.roomName,
        recordingId: payload.egressId,
      });

      if (!meeting) {
        this.logger.warn(`[EGRESS_WEBHOOK] Meeting not found for egress:`, {
          egressId: payload.egressId,
          roomName: payload.roomName,
        });
        return { success: true, message: 'Meeting not found' };
      }

      // Update meeting based on egress status
      switch (payload.status) {
        case 'EGRESS_ACTIVE':
          this.logger.log(`[EGRESS_WEBHOOK] ✅ Recording started for meeting: ${meeting._id}`);
          break;

        case 'EGRESS_ENDING':
          this.logger.log(`[EGRESS_WEBHOOK] ⏳ Recording ending for meeting: ${meeting._id}`);
          break;

        case 'EGRESS_COMPLETE':
          this.logger.log(`[EGRESS_WEBHOOK] ✅ Recording completed for meeting: ${meeting._id}`);
          
          // Update meeting with completion details
          meeting.isRecording = false;
          meeting.recordingStatus = 'STOPPED';
          meeting.recordingEndedAt = new Date(payload.endedAt || Date.now());
          
          // Calculate duration
          if (meeting.recordingStartedAt && payload.endedAt) {
            const duration = Math.floor((payload.endedAt - meeting.recordingStartedAt.getTime()) / 1000);
            meeting.recordingDuration = duration;
          }

          // Upload recording to VOD server if file info is provided
          if (payload.file?.filename) {
            const fileName = payload.file.filename;
            const localFilePath = this.livekitService.getLocalRecordingPath(fileName);
            
            this.logger.log(`[EGRESS_WEBHOOK] 📹 Uploading recording to VOD server: ${fileName}`);
            
            // Upload to VOD server
            const uploadSuccess = await this.livekitService.uploadRecordingToVodServer(localFilePath, fileName);
            
            if (uploadSuccess) {
              const vodServerUrl = this.livekitService.getVodServerUrl();
              meeting.recordingUrl = `${vodServerUrl}/recordings/${fileName}`;
              this.logger.log(`[EGRESS_WEBHOOK] ✅ Recording uploaded to VOD server: ${meeting.recordingUrl}`);
            } else {
              this.logger.error(`[EGRESS_WEBHOOK] ❌ Failed to upload recording to VOD server: ${fileName}`);
              // Fallback to local URL
              meeting.recordingUrl = `/recordings/${fileName}`;
            }
          }

          await meeting.save();
          this.logger.log(`[EGRESS_WEBHOOK] ✅ Meeting updated with completed recording`);
          break;

        case 'EGRESS_FAILED':
          this.logger.error(`[EGRESS_WEBHOOK] ❌ Recording failed for meeting: ${meeting._id}`, {
            error: payload.error,
          });
          
          // Update meeting with failure status
          meeting.isRecording = false;
          meeting.recordingStatus = 'FAILED';
          meeting.recordingEndedAt = new Date();
          
          await meeting.save();
          this.logger.log(`[EGRESS_WEBHOOK] ❌ Meeting updated with failed recording`);
          break;

        default:
          this.logger.log(`[EGRESS_WEBHOOK] ℹ️ Unknown egress status: ${payload.status}`);
      }

      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`[EGRESS_WEBHOOK] ❌ Error processing webhook:`, {
        error: error.message,
        stack: error.stack,
        payload,
      });
      return { success: false, message: 'Webhook processing failed' };
    }
  }
}
