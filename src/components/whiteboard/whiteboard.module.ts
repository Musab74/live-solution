import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WhiteboardService } from './whiteboard.service';
import { WhiteboardResolver } from './whiteboard.resolver';
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../members/member.module';
import { ParticipantModule } from '../participants/participant.module';
import { SignalingModule } from '../signaling/signaling.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from '../../schemas/Meeting.model';
import { Participant, ParticipantSchema } from '../../schemas/Participant.model';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret || secret.trim().length === 0) {
          throw new Error(
            '❌ JWT_SECRET is not set or is empty in .env file! ' +
            'Please set JWT_SECRET in your .env file with at least 32 characters.',
          );
        }
        return {
          secret: secret,
          signOptions: { expiresIn: '24h' },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: Participant.name, schema: ParticipantSchema },
    ]),
    AuthModule,
    MemberModule,
    forwardRef(() => ParticipantModule),
    forwardRef(() => SignalingModule),
  ],
  providers: [WhiteboardService, WhiteboardResolver],
  exports: [WhiteboardService],
})
export class WhiteboardModule {}



