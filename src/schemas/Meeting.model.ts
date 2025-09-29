import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MeetingStatus } from 'src/libs/enums/enums';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Schema({ timestamps: true })
@ObjectType()
export class Meeting {
  @Field(() => ID)
  _id!: string;

  @Field()
  @Prop({ required: true, trim: true })
  title!: string;

  @Field()
  @Prop({
    type: String,
    enum: Object.values(MeetingStatus),
    default: MeetingStatus.SCHEDULED,
    index: true,
  })
  status!: MeetingStatus;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true, index: true })
  hostId!: Types.ObjectId; // Original tutor/creator (never changes)

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Member', required: false, index: true })
  currentHostId?: Types.ObjectId; // Current host for meeting management (can change)

  @Field({ nullable: true })
  @Prop({ required: false, unique: true, index: true, trim: true })
  inviteCode?: string;

  @Field({ nullable: true })
  @Prop()
  passcodeHash?: string; // if you protect rooms

  @Field({ nullable: true })
  @Prop()
  isPrivate?: boolean;

  @Field({ nullable: true })
  @Prop({ default: false })
  isLocked?: boolean;

  @Field({ nullable: true })
  @Prop()
  scheduledFor?: Date; // for 예약된 회의

  @Field({ nullable: true })
  @Prop()
  actualStartAt?: Date; // when it really started

  @Field({ nullable: true })
  @Prop()
  endedAt?: Date;

  @Field({ nullable: true })
  @Prop()
  durationMin?: number;

  @Field({ nullable: true })
  @Prop({ default: 100 })
  maxParticipants?: number;

  @Field({ nullable: true })
  @Prop()
  notes?: string;

  // Recording fields
  @Field({ nullable: true })
  @Prop({ default: false })
  isRecording?: boolean;

  @Field({ nullable: true })
  @Prop()
  recordingStartedAt?: Date;

  @Field({ nullable: true })
  @Prop()
  recordingEndedAt?: Date;

  @Field({ nullable: true })
  @Prop()
  recordingPausedAt?: Date;

  @Field({ nullable: true })
  @Prop()
  recordingResumedAt?: Date;

  @Field({ nullable: true })
  @Prop()
  recordingId?: string;

  @Field({ nullable: true })
  @Prop()
  recordingUrl?: string;

  @Field({ nullable: true })
  @Prop()
  recordingDuration?: number; // in seconds

  @Field({ nullable: true })
  @Prop()
  recordingStatus?: string; // 'recording', 'paused', 'stopped', 'processing'

  // denormalized count for fast lists (optional)
  @Field()
  @Prop({ default: 0 })
  participantCount!: number;

  // Ban list for kicked participants
  @Field(() => [String], { nullable: true })
  @Prop({ type: [String], default: [] })
  bannedUserIds?: string[]; // Array of user IDs who were kicked from this meeting

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export type MeetingDocument = HydratedDocument<Meeting>;
export const MeetingSchema = SchemaFactory.createForClass(Meeting);

MeetingSchema.index({ status: 1, scheduledFor: -1 });
MeetingSchema.index({ hostId: 1, createdAt: -1 });
