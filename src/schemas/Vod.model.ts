import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VodSourceType } from 'src/libs/enums/enums';

@Schema({ timestamps: true })
export class Vod {
  _id!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', index: true })
  meetingId?: Types.ObjectId; // may be linked to a meeting

  @Prop({ type: String, enum: Object.values(VodSourceType), required: true })
  source!: VodSourceType;     // FILE | URL

  // When FILE
  @Prop() storageKey?: string;  // e.g., s3://bucket/key
  @Prop() sizeBytes?: number;

  // When URL
  @Prop() url?: string;

  @Prop() durationSec?: number;
  @Prop() notes?: string;
}

export type VodDocument = HydratedDocument<Vod>;
export const VodSchema = SchemaFactory.createForClass(Vod);
VodSchema.index({ meetingId: 1, createdAt: -1 });
