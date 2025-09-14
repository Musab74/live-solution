import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SystemRole } from 'src/libs/enums/enums';

@Schema({ timestamps: true })
export class Member {
  _id!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true }) // store hash, not raw password
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop() avatarUrl?: string;
  @Prop() organization?: string;
  @Prop() department?: string;
  @Prop() phone?: string;
  @Prop() language?: string;
  @Prop() timezone?: string;

  @Prop({ type: String, enum: Object.values(SystemRole), default: SystemRole.MEMBER, index: true })
  systemRole!: SystemRole;

  @Prop() lastSeenAt?: Date;
}

export type MemberDocument = HydratedDocument<Member>;
export const MemberSchema = SchemaFactory.createForClass(Member);
MemberSchema.index({ email: 1 }, { unique: true });
