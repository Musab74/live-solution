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
  member_type?: string;   // PHP member type (A, T, M, S) - optional for backward compatibility
  role?: string;          // PHP role (admin, tutor, member, staff) - new format
  dept?: string;          // PHP department code (A, T, M, S) - can be used as member_type fallback
  platform?: string;      // PHP platform identifier (optional)
  iat: number;            // issued at (Unix timestamp)
  exp: number;            // expiration (Unix timestamp)
  // Additional optional fields from PHP JWT
  dept_name?: string;
  team?: string;
  device?: string;
  user_type?: string;
}

/**
 * Extract member_type from PHP JWT payload
 * Handles both old format (member_type) and new format (role/dept)
 */
export const extractMemberType = (payload: PHPJwtPayload): string => {
  // Priority 1: Use member_type if present (old format)
  if (payload.member_type) {
    return payload.member_type;
  }
  
  // Priority 2: Use dept if present (new format - dept: 'A' means admin)
  if (payload.dept) {
    return payload.dept;
  }
  
  // Priority 3: Map role to member_type (new format)
  if (payload.role) {
    const roleLower = payload.role.toLowerCase();
    switch (roleLower) {
      case 'admin': return 'A';
      case 'tutor': return 'T';
      case 'member': return 'M';
      case 'staff': return 'A'; // Staff as admin
      case 'student': return 'M'; // Students as members
      default: return 'M';
    }
  }
  
  // Default fallback
  return 'M';
};

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

