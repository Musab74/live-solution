import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MeetingStatus } from 'src/libs/enums/enums';

@Schema({ timestamps: true })
export class Meeting {
  _id!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, enum: Object.values(MeetingStatus), default: MeetingStatus.SCHEDULED, index: true })
  status!: MeetingStatus;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true, index: true })
  hostId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true })
  inviteCode!: string;

  @Prop() passcodeHash?: string;     // if you protect rooms
  @Prop() isPrivate?: boolean;

  @Prop() scheduledStartAt?: Date;   // for 예약된 회의
  @Prop() actualStartAt?: Date;      // when it really started
  @Prop() endedAt?: Date;

  @Prop() durationMin?: number;
  @Prop() notes?: string;

  // denormalized count for fast lists (optional)
  @Prop({ default: 0 }) participantCount!: number;
}

export type MeetingDocument = HydratedDocument<Meeting>;
export const MeetingSchema = SchemaFactory.createForClass(Meeting);

MeetingSchema.index({ status: 1, scheduledStartAt: -1 });
MeetingSchema.index({ hostId: 1, createdAt: -1 });
