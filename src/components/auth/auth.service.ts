import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { shapeIntoMongoObjectId } from "src/libs/config";
import { Member } from "src/schemas/Member.model";
import * as bcrypt from 'bcryptjs'


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
    const claims = await this.jwt.verifyAsync(token);
    // shape to what the app expects as "authMember"
    return {
      _id: shapeIntoMongoObjectId(claims.sub),
      email: claims.email,
      displayName: claims.displayName,
      systemRole: claims.systemRole,
    } as any;
  }
}
