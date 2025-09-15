import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LivekitService } from './livekit.service';
import { LivekitResolver } from './livekit.resolver';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [LivekitService, LivekitResolver],
  exports: [LivekitService],
})
export class LivekitModule {}
