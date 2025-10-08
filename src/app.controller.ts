import { Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { PresenceCleanupService } from './services/presence-cleanup.service';

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
}
