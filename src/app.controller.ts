import { Controller, Get, Post, Query, Res, Param } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { PresenceCleanupService } from './services/presence-cleanup.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly presenceCleanupService: PresenceCleanupService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test')
  getTest(): string {
    return 'Test endpoint working!';
  }

  @Get('admin/stale-participants-stats')
  async getStaleParticipantsStats(@Query('thresholdSeconds') thresholdSeconds: string = '90') {
    const threshold = parseInt(thresholdSeconds, 10);
    return await this.presenceCleanupService.getStaleParticipantsStats(threshold);
  }

  @Post('admin/manual-cleanup')
  async manualCleanup(@Query('thresholdSeconds') thresholdSeconds: string = '90') {
    const threshold = parseInt(thresholdSeconds, 10);
    const cleanedCount = await this.presenceCleanupService.manualCleanup(threshold);
    return {
      success: true,
      cleanedCount,
      thresholdSeconds: threshold,
      message: `Cleaned up ${cleanedCount} stale participants with ${threshold}s threshold`
    };
  }

  @Get('uploads/recordings/:filename')
  async serveRecording(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const filePath = path.join(process.cwd(), 'uploads', 'recordings', filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Recording file not found' });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error(`[APP_CONTROLLER] Error serving recording: ${error.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
