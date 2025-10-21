import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { SSOService } from '../sso.service';

/**
 * SSO JWT Guard - Verifies JWT tokens from PHP website
 * 
 * This guard is DIFFERENT from the standard AuthGuard:
 * - AuthGuard: Verifies NestJS-generated tokens
 * - SSOJwtGuard: Verifies PHP-generated tokens
 * 
 * Use this guard for SSO endpoints that accept PHP JWT tokens
 */
@Injectable()
export class SSOJwtGuard implements CanActivate {
  private readonly logger = new Logger(SSOJwtGuard.name);

  constructor(private ssoService: SSOService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const type = ctx.getType<'http' | 'graphql' | 'ws'>();

    // Extract token from request
    const getToken = (): string | null => {
      if (type === 'http') {
        const req = ctx.switchToHttp().getRequest();
        // Try Bearer token first
        const authHeader = req.headers?.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          return authHeader.split(' ')[1];
        }
        // Fallback to query parameter (for testing)
        return req.query?.token || null;
      }

      if (type === 'graphql') {
        const req = (ctx as any).getArgByIndex(2).req;
        const authHeader = req.headers?.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          return authHeader.split(' ')[1];
        }
        return null;
      }

      if (type === 'ws') {
        const client: any = ctx.switchToWs().getClient();
        return (
          client?.handshake?.auth?.token ||
          client?.handshake?.headers?.authorization?.split(' ')[1] ||
          client?.token ||
          null
        );
      }

      return null;
    };

    const token = getToken();
    if (!token) {
      this.logger.warn('❌ SSO JWT token not provided');
      throw new BadRequestException('JWT token is required for SSO authentication');
    }

    try {
      // Verify PHP JWT token
      const jwtPayload = this.ssoService.verifyPHPToken(token);

      // Attach JWT payload to request for use in resolvers/controllers
      if (type === 'http') {
        ctx.switchToHttp().getRequest().phpJwt = jwtPayload;
      }
      if (type === 'graphql') {
        (ctx as any).getArgByIndex(2).req.phpJwt = jwtPayload;
      }
      if (type === 'ws') {
        ctx.switchToWs().getClient().phpJwt = jwtPayload;
      }

      this.logger.log(`✅ SSO JWT verified for: ${jwtPayload.email}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ SSO JWT verification failed: ${error.message}`);
      throw new UnauthorizedException(
        `SSO authentication failed: ${error.message}`,
      );
    }
  }
}


