import { Resolver, Query } from '@nestjs/graphql';
import { HealthService } from './health.service';

@Resolver()
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Query(() => String, { name: 'health' })
  async getHealth() {
    const health = await this.healthService.getHealth();
    return JSON.stringify(health, null, 2);
  }
}
