import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SystemRole } from 'src/libs/enums/enums';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Schema({ timestamps: true })
@ObjectType()
export class Member {
  @Field(() => ID)
  _id!: string;

  @Prop({ required: false, unique: true, sparse: true, trim: true })
  @Field({ nullable: true })
  user_id?: string; // PHP user ID for SSO integration

  @Prop({
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  @Field()
  email!: string;

  @Prop({ required: false, default: '' }) // store hash, not raw password - optional for SSO users
  passwordHash?: string;

  @Prop({ required: true, trim: true })
  @Field()
  displayName!: string;

  @Prop()
  @Field({ nullable: true })
  avatarUrl?: string;

  @Prop()
  @Field({ nullable: true })
  organization?: string;

  @Prop()
  @Field({ nullable: true })
  department?: string;

  @Prop()
  @Field({ nullable: true })
  phone?: string;

  @Prop()
  @Field({ nullable: true })
  language?: string;

  @Prop()
  @Field({ nullable: true })
  timezone?: string;

  @Prop({
    type: String,
    enum: Object.values(SystemRole),
    default: SystemRole.MEMBER,
    index: true,
  })
  @Field()
  systemRole!: SystemRole;

  @Prop()
  @Field({ nullable: true })
  lastSeenAt?: Date;

  @Prop({ default: false })
  @Field()
  isBlocked!: boolean;

  @Prop()
  @Field({ nullable: true })
  blockedAt?: Date;

  @Prop()
  @Field({ nullable: true })
  blockedBy?: string;

  @Prop()
  @Field({ nullable: true })
  blockReason?: string;

  @Prop()
  @Field({ nullable: true })
  unblockedAt?: Date;

  @Prop()
  @Field({ nullable: true })
  unblockedBy?: string;
}

export type MemberDocument = HydratedDocument<Member>;
export const MemberSchema = SchemaFactory.createForClass(Member);
MemberSchema.index({ email: 1 }, { unique: true });
