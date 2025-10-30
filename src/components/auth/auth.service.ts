import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { shapeIntoMongoObjectId } from 'src/libs/config';
import { Member } from 'src/schemas/Member.model';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  async hashPassword(raw: string) {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(raw, salt);
  }
  async comparePassword(raw: string, hash: string) {
    return bcrypt.compare(raw, hash);
  }

  async createToken(member: Member): Promise<string> {
    const payload = {
      sub: String(member._id),
      email: member.email,
      displayName: member.displayName,
      systemRole: member.systemRole, // ADMIN/MEMBER
    };
    return this.jwt.signAsync(payload); // expiry/secret from JwtModule
  }

  async verifyToken(token: string): Promise<Member> {
    try {
      const claims = await this.jwt.verifyAsync(token);
      // shape to what the app expects as "authMember"
      return {
        _id: shapeIntoMongoObjectId(claims.sub),
        email: claims.email,
        displayName: claims.displayName,
        systemRole: claims.systemRole,
      } as any;
    } catch (error: any) {
      // Enhanced error logging
      if (error.message?.includes('invalid signature')) {
        console.error('❌ JWT verification failed: invalid signature');
        console.error('⚠️  This usually means:');
        console.error('   1. The token was signed with a different JWT_SECRET');
        console.error('   2. JWT_SECRET in .env was changed after token was generated');
        console.error('   3. You might be using a PHP token instead of a NestJS token');
        console.error('💡 Solution: Clear old tokens from localStorage and re-authenticate');
      }
      if (error.message?.includes('secret or public key must be provided')) {
        console.error('❌ JWT verification failed: JWT_SECRET is not configured');
        console.error('⚠️  Please set JWT_SECRET in your .env file');
      }
      // Log the error for debugging
      console.error('❌ JWT verification failed:', error.message);
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
}
