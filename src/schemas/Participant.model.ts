import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MediaState, Role, ParticipantStatus } from 'src/libs/enums/enums';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Session {
  @Field()
  @Prop({ required: true }) joinedAt!: Date;
  
  @Field({ nullable: true })
  @Prop() leftAt?: Date;
  
  @Field()
  @Prop({ default: 0 }) durationSec!: number;
}

const SessionSchema = SchemaFactory.createForClass(Session);

@Schema({ timestamps: true })
@ObjectType()
export class Participant {
  @Field(() => ID)
  _id!: string;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId!: Types.ObjectId;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Member', index: true })
  userId?: Types.ObjectId; // null for guests

  @Field()
  @Prop({ required: true, trim: true })
  displayName!: string;

  @Field()
  @Prop({ type: String, enum: Object.values(Role), default: Role.PARTICIPANT, index: true })
  role!: Role;

  // Option 1 (chosen): forced states included in enum
  @Field()
  @Prop({ type: String, enum: Object.values(MediaState), default: MediaState.OFF })
  micState!: MediaState;      // ON | OFF | MUTED | MUTED_BY_HOST

  @Field()
  @Prop({ type: String, enum: Object.values(MediaState), default: MediaState.OFF })
  cameraState!: MediaState;   // ON | OFF | OFF_BY_ADMIN

  @Field()
  @Prop({ type: String, enum: Object.values(ParticipantStatus), default: ParticipantStatus.WAITING })
  status!: ParticipantStatus; // WAITING | APPROVED | REJECTED | ADMITTED | LEFT

  // live socket info (optional)
  @Field({ nullable: true })
  @Prop() socketId?: string;

  // attendance: multiple sessions if reconnects
  @Field(() => [Session])
  @Prop({ type: [SessionSchema], default: [] })
  sessions!: Session[];

  @Field()
  @Prop({ default: 0 }) totalDurationSec!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export type ParticipantDocument = HydratedDocument<Participant>;
export const ParticipantSchema = SchemaFactory.createForClass(Participant);

ParticipantSchema.index({ meetingId: 1, userId: 1 }, { unique: false });
ParticipantSchema.index({ meetingId: 1, createdAt: 1 });
