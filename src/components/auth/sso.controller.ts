import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  Query,
} from '@nestjs/common';
import { SSOService } from './sso.service';
import { SSOLoginResponse } from '../../libs/DTO/auth/sso.input';
import { SystemRole } from '../../libs/enums/enums';

/**
 * REST API Controller for SSO Authentication
 * 
 * Provides REST endpoints for Single Sign-On integration with PHP website
 */
@Controller('auth')
export class SSOController {
  private readonly logger = new Logger(SSOController.name);

  constructor(private ssoService: SSOService) {}

  /**
   * SSO Login Endpoint (POST)
   * 
   * Accepts JWT token from PHP website in request body
   * 
   * @route POST /auth/sso-login
   * @body { token: string }
   * @returns User data and NestJS token
   * 
   * @example Request
   * ```bash
   * curl -X POST http://localhost:3000/auth/sso-login \
   *   -H "Content-Type: application/json" \
   *   -d '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
   * ```
   * 
   * @example Response
   * ```json
   * {
   *   "success": true,
   *   "existed": true,
   *   "message": "User user@example.com updated successfully via SSO",
   *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "user": {
   *     "_id": "507f1f77bcf86cd799439011",
   *     "email": "user@example.com",
   *     "displayName": "홍길동",
   *     "systemRole": "MEMBER",
   *     "lastSeenAt": "2025-10-20T10:00:00.000Z"
   *   }
   * }
   * ```
   */
  @Post('sso-login')
  @HttpCode(HttpStatus.OK)
  async ssoLogin(
    @Body('token') token: string,
  ): Promise<SSOLoginResponse> {
    this.logger.log('🔐 SSO Login request received via REST API');

    if (!token) {
      this.logger.error('❌ Token not provided in request body');
      return {
        success: false,
        existed: false,
        user: null,
        token: '',
        message: 'Token is required'
      };
    }

    try {
      const result = await this.ssoService.ssoLogin(token);

      // Determine redirect URL based on systemRole
      const redirectUrl = this.getDashboardUrl(result.user.systemRole);

      this.logger.log(
        `✅ SSO Login successful for ${result.user.user_id} (${result.user.displayName}) - ${result.existed ? 'existing' : 'new'} user`,
      );

      return {
        ...result,
        redirectUrl: redirectUrl
      };
    } catch (error) {
      this.logger.error(`❌ SSO Login failed: ${error.message}`);
      return {
        success: false,
        existed: false,
        user: null,
        token: '',
        message: error.message
      };
    }
  }

  /**
   * SSO Login Endpoint (GET) - Alternative for testing
   * 
   * Accepts JWT token as query parameter (useful for quick testing)
   * ⚠️ WARNING: Not recommended for production - use POST instead
   * 
   * @route GET /auth/sso-login?token=xxx
   * @query token - JWT token from PHP
   * @returns User data and NestJS token
   * 
   * @example Request
   * ```bash
   * curl "http://localhost:3000/auth/sso-login?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * ```
   */
  @Get('sso-login')
  async ssoLoginGet(
    @Query('token') token: string,
  ): Promise<SSOLoginResponse> {
    this.logger.log('🔐 SSO Login request received via GET (testing mode)');

    if (!token) {
      this.logger.error('❌ Token not provided in query parameter');
      throw new Error('Token query parameter is required');
    }

    return this.ssoLogin(token);
  }

  /**
   * Health check endpoint for SSO service
   * 
   * @route GET /auth/sso-health
   * @returns Service status
   */
  @Get('sso-health')
  async ssoHealth() {
    return {
      service: 'SSO Authentication',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        post: '/auth/sso-login',
        get: '/auth/sso-login?token=xxx',
        graphql: 'mutation ssoLogin',
      },
    };
  }

  /**
   * Get dashboard URL based on user's system role
   * @param systemRole - User's system role
   * @returns Dashboard URL
   */
  private getDashboardUrl(systemRole: SystemRole): string {
    switch (systemRole) {
      case SystemRole.ADMIN:
        return '/admin/dashboard';
      case SystemRole.TUTOR:
        return '/tutor/dashboard';
      case SystemRole.MEMBER:
      default:
        return '/dashboard';
    }
  }
}

