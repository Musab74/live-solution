import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Invite {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: true, index: true })
  meetingId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true })
  code!: string; // same as inviteCode or separate invite token

  @Prop({ type: [String], default: [] })
  sentTo!: string[]; // emails

  @Prop({ type: Date })
  expiresAt?: Date; // optional TTL
}

export type InviteDocument = HydratedDocument<Invite>;
export const InviteSchema = SchemaFactory.createForClass(Invite);
InviteSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $exists: true } },
  },
);
