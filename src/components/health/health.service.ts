import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private connection: Connection,
    private configService: ConfigService,
  ) {}

  async getHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: await this.checkDatabase(),
        livekit: await this.checkLivekit(),
        memory: this.checkMemory(),
        uptime: process.uptime(),
      },
    };

    // Overall status is unhealthy if any service is down
    const allHealthy = Object.values(health.services).every(
      service => typeof service === 'object' && service.status === 'healthy'
    );
    
    if (!allHealthy) {
      health.status = 'unhealthy';
    }

    return health;
  }

  private async checkDatabase() {
    try {
      const state = this.connection.readyState;
      return {
        status: state === 1 ? 'healthy' : 'unhealthy',
        state: state === 1 ? 'connected' : 'disconnected',
        message: state === 1 ? 'Database connected' : 'Database disconnected',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkLivekit() {
    try {
      const livekitUrl = this.configService.get('LIVEKIT_URL');
      const livekitApiKey = this.configService.get('LIVEKIT_API_KEY');
      
      if (!livekitUrl || !livekitApiKey) {
        return {
          status: 'unhealthy',
          message: 'LiveKit configuration missing',
        };
      }

      // Simple connectivity check - in production, you might want to ping the LiveKit server
      return {
        status: 'healthy',
        url: livekitUrl,
        message: 'LiveKit configuration present',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private checkMemory() {
    const memUsage = process.memoryUsage();
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const freeMB = totalMB - usedMB;

    return {
      status: 'healthy',
      total: `${totalMB}MB`,
      used: `${usedMB}MB`,
      free: `${freeMB}MB`,
      usage: `${Math.round((usedMB / totalMB) * 100)}%`,
    };
  }
}
