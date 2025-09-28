import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LivekitService } from './livekit.service';
import { LivekitResolver } from './livekit.resolver';
import { SignalingGateway } from './signaling.gateway';
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../members/member.module';
import { ParticipantModule } from '../participants/participant.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    MemberModule,
    ParticipantModule,
    ChatModule,
  ],
  providers: [LivekitService, LivekitResolver, SignalingGateway],
  exports: [LivekitService, SignalingGateway],
})
export class SignalingModule {}
