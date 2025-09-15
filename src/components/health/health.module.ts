import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthService } from './health.service';
import { HealthResolver } from './health.resolver';

@Module({
  imports: [MongooseModule],
  providers: [HealthService, HealthResolver],
  exports: [HealthService],
})
export class HealthModule {}
