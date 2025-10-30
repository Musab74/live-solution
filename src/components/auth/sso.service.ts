import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Member, MemberDocument } from '../../schemas/Member.model';
import { PHPJwtPayload, UserSyncResult, mapMemberType } from '../../libs/DTO/auth/sso.input';
import { SystemRole } from '../../libs/enums/enums';
import { AuthService } from './auth.service';

@Injectable()
export class SSOService {
  private readonly logger = new Logger(SSOService.name);
  private readonly jwtSecretKey: string;

  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    // CRITICAL: Must be the SAME secret as PHP website
    this.jwtSecretKey = this.configService.get<string>('JWT_SECRET_KEY') || '';
    
    if (!this.jwtSecretKey || this.jwtSecretKey.length < 32) {
      this.logger.error('❌ JWT_SECRET_KEY is not set or too short in .env file!');
      throw new Error(
        'JWT_SECRET_KEY must be set in .env and be at least 32 characters long',
      );
    }
    
    this.logger.log('✅ SSO Service initialized with JWT_SECRET_KEY');
  }

  /**
   * Verify JWT token from PHP website
   * @param token - JWT token from PHP
   * @returns Decoded JWT payload
   * @throws UnauthorizedException if token is invalid
   */
  verifyPHPToken(token: string): PHPJwtPayload {
    try {
      // Verify JWT signature and decode payload
      const decoded = jwt.verify(token, this.jwtSecretKey, {
        algorithms: ['HS256'], // PHP typically uses HS256
      }) as PHPJwtPayload;

      this.logger.log(`✅ JWT verified for user: ${decoded.user_id} (${decoded.name})`);

      // Validate required fields for PHP JWT structure
      if (!decoded.user_id || !decoded.name || !decoded.member_type) {
        throw new BadRequestException(
          'JWT payload missing required fields (user_id, name, or member_type)',
        );
      }

      return decoded;
    } catch (error) {
      // Enhanced error logging
      if (error.name === 'JsonWebTokenError' && error.message.includes('invalid signature')) {
        this.logger.error(`❌ JWT verification failed: invalid signature`);
        this.logger.error(`⚠️  This usually means JWT_SECRET_KEY in NestJS doesn't match the secret used by PHP website`);
        this.logger.error(`⚠️  Current JWT_SECRET_KEY length: ${this.jwtSecretKey?.length || 0} characters`);
        this.logger.error(`⚠️  Please ensure JWT_SECRET_KEY in .env matches exactly with PHP website's JWT secret`);
        throw new UnauthorizedException(
          'Invalid JWT token: Signature verification failed. ' +
          'Please ensure JWT_SECRET_KEY in NestJS backend matches the secret used by PHP website.',
        );
      }
      
      this.logger.error(`❌ JWT verification failed: ${error.message}`);

      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('JWT token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(`Invalid JWT token: ${error.message}`);
      }
      if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('JWT token not yet valid');
      }

      throw new UnauthorizedException(`JWT verification failed: ${error.message}`);
    }
  }

  /**
   * Sync user from PHP JWT to MongoDB
   * - If user exists: UPDATE (displayName, systemRole, lastSeenAt, updatedAt)
   * - If user doesn't exist: CREATE new user with JWT data
   * @param jwtPayload - Decoded JWT payload from PHP
   * @returns UserSyncResult with existed flag and user document
   */
  async syncUserFromJWT(jwtPayload: PHPJwtPayload): Promise<UserSyncResult> {
    const { user_id, name, email, member_type, platform } = jwtPayload;

    try {
      // Map PHP member_type to NestJS SystemRole
      const systemRole = mapMemberType(member_type) as SystemRole;
      
      // Check if user exists by user_id or email (since email might be encrypted)
      const existingUser = await this.memberModel.findOne({
        $or: [
          { user_id: user_id },
          { email: email }
        ]
      });

      const currentTime = new Date();

      if (existingUser) {
        // ✅ USER EXISTS - UPDATE
        this.logger.log(`🔄 Updating existing user: ${user_id} (${name})`);

        existingUser.user_id = user_id;
        existingUser.displayName = name;
        existingUser.email = email; // Update email in case it changed
        existingUser.systemRole = systemRole;
        existingUser.lastSeenAt = currentTime;
        existingUser.isBlocked = false; // Default to not blocked
        // updatedAt is automatically managed by Mongoose timestamps

        const updatedUser = await existingUser.save();

        return {
          existed: true,
          user: updatedUser,
          message: `User ${user_id} (${name}) updated successfully via SSO`,
        };
      } else {
        // ✅ USER DOESN'T EXIST - CREATE
        this.logger.log(`✨ Creating new user from SSO: ${user_id} (${name})`);

        // Create new user WITHOUT password (SSO users don't need password in this system)
        const newUser = new this.memberModel({
          user_id: user_id,
          email: email,
          displayName: name,
          systemRole: systemRole,
          lastSeenAt: currentTime,
          isBlocked: false,
          // passwordHash is optional for SSO users - they login via PHP
          // createdAt and updatedAt are automatically managed by Mongoose timestamps
        });

        const savedUser = await newUser.save();

        return {
          existed: false,
          user: savedUser,
          message: `New user ${user_id} (${name}) created successfully via SSO`,
        };
      }
    } catch (error) {
      this.logger.error(`❌ User sync failed for ${user_id} (${name}): ${error.message}`);
      throw new BadRequestException(
        `Failed to sync user: ${error.message}`,
      );
    }
  }

  /**
   * Complete SSO login flow:
   * 1. Verify PHP JWT token
   * 2. Sync user to MongoDB
   * 3. Generate new NestJS JWT token for future requests
   * @param phpToken - JWT token from PHP website
   * @returns User, token, and sync info
   */
  async ssoLogin(phpToken: string) {
    // Step 1: Verify PHP JWT
    const jwtPayload = this.verifyPHPToken(phpToken);

    // Step 2: Sync user to MongoDB
    const syncResult = await this.syncUserFromJWT(jwtPayload);

    // Step 3: Generate NestJS JWT token for future API calls
    const nestToken = await this.authService.createToken(syncResult.user);

    this.logger.log(
      `✅ SSO Login successful for ${syncResult.user.email} (${syncResult.existed ? 'existing' : 'new'} user)`,
    );

    return {
      success: true,
      existed: syncResult.existed,
      user: syncResult.user,
      token: nestToken, // NestJS token for subsequent API calls
      message: syncResult.message,
    };
  }
}

