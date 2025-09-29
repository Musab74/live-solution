import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatSocketGateway } from './chat-socket.gateway';
import { MemberModule } from '../components/members/member.module';
import { ChatModule } from '../components/chat/chat.module';

@Module({
  imports: [
    JwtModule.register({
      secret: `${process.env.JWT_SECRET}`,
      signOptions: { expiresIn: '3h' },
    }),
    MemberModule,
    ChatModule,
  ],
  providers: [ChatSocketGateway],
  exports: [ChatSocketGateway],
})
export class SocketModule {}
