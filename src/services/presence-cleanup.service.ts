import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ParticipantService } from '../components/participants/participant.service';

@Injectable()
export class PresenceCleanupService {
  private readonly logger = new Logger(PresenceCleanupService.name);

  constructor(
    private participantService: ParticipantService,
  ) {}

  /**
   * Run every 3 minutes to clean up stale participants
   * This ensures no ghost participants remain even if WebSocket disconnect is missed
   * Using 150-second threshold to allow for heartbeat grace period
   */
  @Cron('0 */3 * * * *') // Every 3 minutes
  async cleanupStaleParticipants() {
    try {
      const cleanedCount = await this.participantService.cleanupStaleParticipants(150); // 150 seconds threshold - allows for heartbeat grace period
      
      if (cleanedCount > 0) {
        this.logger.log(`[CLEANUP] Cleaned up ${cleanedCount} stale participants`);
      }
    } catch (error) {
      this.logger.error(`[CLEANUP] Error during stale participant cleanup: ${error.message}`);
    }
  }

  /**
   * Manual cleanup method for testing or emergency cleanup
   */
  async manualCleanup(thresholdSeconds: number = 90): Promise<number> {
    try {
      this.logger.log(`[MANUAL_CLEANUP] Starting manual cleanup with ${thresholdSeconds}s threshold`);
      const cleanedCount = await this.participantService.cleanupStaleParticipants(thresholdSeconds);
      this.logger.log(`[MANUAL_CLEANUP] Manual cleanup completed: ${cleanedCount} participants cleaned`);
      return cleanedCount;
    } catch (error) {
      this.logger.error(`[MANUAL_CLEANUP] Error during manual cleanup: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics about stale participants (for monitoring)
   */
  async getStaleParticipantsStats(thresholdSeconds: number = 90): Promise<{
    totalStale: number;
    staleInWaiting: number;
    staleAdmitted: number;
  }> {
    try {
      const threshold = new Date(Date.now() - (thresholdSeconds * 1000));
      
      // This would require additional methods in ParticipantService
      // For now, we'll return basic stats
      const totalStale = await this.participantService.getStaleParticipantsCount(thresholdSeconds);
      
      return {
        totalStale,
        staleInWaiting: 0, // TODO: Implement specific counts
        staleAdmitted: 0,  // TODO: Implement specific counts
      };
    } catch (error) {
      this.logger.error(`[STATS] Error getting stale participants stats: ${error.message}`);
      return {
        totalStale: 0,
        staleInWaiting: 0,
        staleAdmitted: 0,
      };
    }
  }
}
