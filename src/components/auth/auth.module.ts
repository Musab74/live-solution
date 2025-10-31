import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { SSOService } from './sso.service';
import { SSOResolver } from './sso.resolver';
import { SSOController } from './sso.controller';
import { SSOJwtGuard } from './guards/sso-jwt.guard';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Member, MemberSchema } from '../../schemas/Member.model';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    MongooseModule.forFeature([{ name: Member.name, schema: MemberSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SSOController],
  providers: [AuthService, SSOService, SSOResolver, SSOJwtGuard],
  exports: [AuthService, SSOService, SSOJwtGuard, JwtModule],
})
export class AuthModule {}
