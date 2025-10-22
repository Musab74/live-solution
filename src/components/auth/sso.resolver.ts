import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { SSOService } from './sso.service';
import { SSOLoginInput, SSOLoginResult } from '../../libs/DTO/auth/sso.input';

/**
 * GraphQL Resolver for SSO Authentication
 * 
 * Provides mutations for Single Sign-On integration with PHP website
 */
@Resolver()
export class SSOResolver {
  private readonly logger = new Logger(SSOResolver.name);

  constructor(private ssoService: SSOService) {}

  /**
   * SSO Login Mutation
   * 
   * Accepts JWT token from PHP website, verifies it, syncs user to MongoDB,
   * and returns a new NestJS JWT token for API authentication
   * 
   * @param ssoLoginInput - Contains JWT token from PHP
   * @returns SSOLoginResult with user data and NestJS token
   * 
   * @example GraphQL Mutation
   * ```graphql
   * mutation SSOLogin($token: String!) {
   *   ssoLogin(input: { token: $token }) {
   *     success
   *     existed
   *     message
   *     token
   *     user {
   *       _id
   *       email
   *       displayName
   *       systemRole
   *       lastSeenAt
   *     }
   *   }
   * }
   * ```
   */
  @Mutation(() => SSOLoginResult, {
    description: 'SSO Login - Authenticate using JWT token from PHP website',
  })
  async ssoLogin(
    @Args('input') ssoLoginInput: SSOLoginInput,
  ): Promise<SSOLoginResult> {
    this.logger.log('🔐 SSO Login request received via GraphQL');

    try {
      const result = await this.ssoService.ssoLogin(ssoLoginInput.token);

      this.logger.log(
        `✅ SSO Login successful for ${result.user.email} (${result.existed ? 'existing' : 'new'} user)`,
      );

      return result;
    } catch (error) {
      this.logger.error(`❌ SSO Login failed: ${error.message}`);
      throw error;
    }
  }
}



