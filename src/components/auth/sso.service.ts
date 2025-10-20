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
import { PHPJwtPayload, UserSyncResult } from '../../libs/DTO/auth/sso.input';
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

      this.logger.log(`✅ JWT verified for user: ${decoded.email}`);

      // Validate required fields
      if (!decoded.email || !decoded.displayName || !decoded.systemRole) {
        throw new BadRequestException(
          'JWT payload missing required fields (email, displayName, or systemRole)',
        );
      }

      return decoded;
    } catch (error) {
      this.logger.error(`❌ JWT verification failed: ${error.message}`);

      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('JWT token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid JWT token');
      }
      if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('JWT token not yet valid');
      }

      throw new UnauthorizedException('JWT verification failed');
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
    const { email, displayName, systemRole, lastSeenAt, isBlocked } =
      jwtPayload;

    try {
      // Check if user exists
      const existingUser = await this.memberModel.findOne({ email });

      if (existingUser) {
        // ✅ USER EXISTS - UPDATE
        this.logger.log(`🔄 Updating existing user: ${email}`);

        existingUser.displayName = displayName;
        existingUser.systemRole = systemRole as SystemRole;
        existingUser.lastSeenAt = new Date(lastSeenAt);
        existingUser.isBlocked = isBlocked;
        // updatedAt is automatically managed by Mongoose timestamps

        const updatedUser = await existingUser.save();

        return {
          existed: true,
          user: updatedUser,
          message: `User ${email} updated successfully via SSO`,
        };
      } else {
        // ✅ USER DOESN'T EXIST - CREATE
        this.logger.log(`✨ Creating new user from SSO: ${email}`);

        // Create new user WITHOUT password (SSO users don't need password in this system)
        const newUser = new this.memberModel({
          email,
          displayName,
          systemRole: systemRole as SystemRole,
          lastSeenAt: new Date(lastSeenAt),
          isBlocked,
          passwordHash: '', // SSO users don't have password - they login via PHP
          // createdAt and updatedAt are automatically managed by Mongoose timestamps
        });

        const savedUser = await newUser.save();

        return {
          existed: false,
          user: savedUser,
          message: `New user ${email} created successfully via SSO`,
        };
      }
    } catch (error) {
      this.logger.error(`❌ User sync failed for ${email}: ${error.message}`);
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

