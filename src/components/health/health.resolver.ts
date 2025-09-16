import { Resolver, Query } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { HealthService } from './health.service';

@Resolver()
export class HealthResolver {
  private readonly logger = new Logger(HealthResolver.name);

  constructor(private readonly healthService: HealthService) {}

  @Query(() => String, { name: 'health' })
  async getHealth() {
    this.logger.log(`[HEALTH_CHECK] Attempt`);
    try {
      const health = await this.healthService.getHealth();
      this.logger.log(`[HEALTH_CHECK] Success - Status: ${health.status}`);
      return JSON.stringify(health, null, 2);
    } catch (error) {
      this.logger.error(`[HEALTH_CHECK] Failed - Error: ${error.message}`);
      throw error;
    }
  }
}
