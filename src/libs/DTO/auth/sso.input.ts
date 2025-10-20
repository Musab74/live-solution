import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';
import { Member } from 'src/schemas/Member.model';

/**
 * Input for SSO Login - accepts JWT token from PHP website
 */
@InputType()
export class SSOLoginInput {
  @Field(() => String, {
    description: 'JWT token from PHP website (from localStorage)',
  })
  @IsNotEmpty({ message: 'JWT token is required' })
  @IsString()
  @IsJWT({ message: 'Invalid JWT token format' })
  token!: string;
}

/**
 * JWT Payload from PHP website
 * Must match exactly what PHP generates
 */
export interface PHPJwtPayload {
  email: string;
  displayName: string;
  systemRole: string; // 'MEMBER', 'TUTOR', 'ADMIN'
  lastSeenAt: string; // ISO 8601 date string
  isBlocked: boolean;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  iat: number; // issued at (Unix timestamp)
  exp: number; // expiration (Unix timestamp)
}

/**
 * Result of user sync operation
 */
export interface UserSyncResult {
  existed: boolean; // true if user existed, false if newly created
  user: Member; // the synced user document
  message: string; // descriptive message
}

/**
 * GraphQL response for SSO login
 */
@ObjectType()
export class SSOLoginResult {
  @Field(() => Boolean, {
    description: 'Whether the SSO login was successful',
  })
  success!: boolean;

  @Field(() => Boolean, {
    description: 'Whether the user existed before (true) or was newly created (false)',
  })
  existed!: boolean;

  @Field(() => Member, {
    description: 'The authenticated user',
  })
  user!: Member;

  @Field(() => String, {
    description: 'JWT token for future requests (NestJS-generated)',
  })
  token!: string;

  @Field(() => String, {
    description: 'Success or error message',
  })
  message!: string;
}

/**
 * REST API response for SSO login
 */
export interface SSOLoginResponse {
  success: boolean;
  existed: boolean;
  user: Member;
  token: string;
  message: string;
}

