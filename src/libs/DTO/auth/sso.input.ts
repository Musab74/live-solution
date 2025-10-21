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
 * Updated to match actual PHP JWT structure
 */
export interface PHPJwtPayload {
  user_id: string;        // PHP user ID (primary identifier)
  name: string;           // PHP user display name
  email: string;          // PHP email (may be encrypted)
  member_type: string;    // PHP member type (A, T, M, S)
  platform: string;       // PHP platform identifier
  iat: number;            // issued at (Unix timestamp)
  exp: number;            // expiration (Unix timestamp)
}

/**
 * Map PHP member_type to NestJS SystemRole
 */
export const mapMemberType = (memberType: string): string => {
  switch (memberType) {
    case 'A': return 'ADMIN';
    case 'T': return 'TUTOR';
    case 'M': return 'MEMBER';
    case 'S': return 'MEMBER'; // Students as members
    default: return 'MEMBER';
  }
};

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
  redirectUrl?: string; // Dashboard URL based on user role
}

