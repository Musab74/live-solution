// database.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const isProd = cfg.get('NODE_ENV') === 'production';
        const uri = isProd ? cfg.get<string>('MONGODB_PROD') : cfg.get<string>('MONGODB');
        if (!uri) throw new Error('MONGO URI missing. Set MONGODB/MONGODB_PROD in .env');
        return { uri, autoIndex: true };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {
  constructor(@InjectConnection() conn: Connection) {
    conn.on('connected', () => console.log('Mongo connected'));
    conn.on('error', (e) => console.error('Mongo error:', e.message));
  }
}
