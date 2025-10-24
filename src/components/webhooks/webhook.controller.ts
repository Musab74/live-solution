import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting } from '../../schemas/Meeting.model';

interface EgressWebhookPayload {
  egressId: string;
  roomName: string;
  status: 'EGRESS_STARTING' | 'EGRESS_ACTIVE' | 'EGRESS_ENDING' | 'EGRESS_COMPLETE' | 'EGRESS_FAILED' | 'EGRESS_ABORTED';
  startedAt?: number;
  endedAt?: number;
  error?: string;
  file?: {
    filename: string;
    size: number;
    location: string;
  };
  // Additional LiveKit egress fields
  roomId?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  stream?: {
    url: string;
    startedAt?: number;
    endedAt?: number;
  };
  segments?: {
    filename: string;
    size: number;
    location: string;
  }[];
  playlist?: {
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
  ) {}

  @Post('egress')
  @HttpCode(HttpStatus.OK)
  async handleEgressWebhook(@Body() payload: any) {
    // Client-side recording - no egress webhooks needed
    this.logger.log(`[WEBHOOK] Egress webhook received but ignored - using client-side recording`);
    return { success: true, message: 'Client-side recording - webhook ignored' };
  }
}
