import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MediaState, Role } from 'src/libs/enums/enums';

class Session {
  @Prop({ required: true }) joinedAt!: Date;
  @Prop() leftAt?: Date;
  @Prop({ default: 0 }) durationSec!: number;
}

const SessionSchema = SchemaFactory.createForClass(Session);

@Schema({ timestamps: true })
export class Participant {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member', index: true })
  userId?: Types.ObjectId; // null for guests

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.PARTICIPANT, index: true })
  role!: Role;

  // Option 1 (chosen): forced states included in enum
  @Prop({ type: String, enum: Object.values(MediaState), default: MediaState.OFF })
  micState!: MediaState;      // ON | OFF | MUTED | MUTED_BY_HOST

  @Prop({ type: String, enum: Object.values(MediaState), default: MediaState.OFF })
  cameraState!: MediaState;   // ON | OFF | OFF_BY_ADMIN

  // live socket info (optional)
  @Prop() socketId?: string;

  // attendance: multiple sessions if reconnects
  @Prop({ type: [SessionSchema], default: [] })
  sessions!: Session[];

  @Prop({ default: 0 }) totalDurationSec!: number;
}

export type ParticipantDocument = HydratedDocument<Participant>;
export const ParticipantSchema = SchemaFactory.createForClass(Participant);

ParticipantSchema.index({ meetingId: 1, userId: 1 }, { unique: false });
ParticipantSchema.index({ meetingId: 1, createdAt: 1 });
