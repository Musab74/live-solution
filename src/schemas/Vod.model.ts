import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VodSourceType } from 'src/libs/enums/enums';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Schema({ timestamps: true })
@ObjectType()
export class Vod {
  @Field(() => ID)
  _id!: string;

  @Field()
  @Prop({ required: true, trim: true })
  title!: string;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Meeting', index: true })
  meetingId?: Types.ObjectId; // may be linked to a meeting

  @Field()
  @Prop({ type: String, enum: Object.values(VodSourceType), required: true })
  source!: VodSourceType; // FILE | URL

  // When FILE
  @Field({ nullable: true })
  @Prop()
  storageKey?: string; // e.g., s3://bucket/key

  @Field({ nullable: true })
  @Prop()
  sizeBytes?: number;

  // When URL
  @Field({ nullable: true })
  @Prop()
  url?: string;

  @Field({ nullable: true })
  @Prop()
  durationSec?: number;

  @Field({ nullable: true })
  @Prop()
  notes?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export type VodDocument = HydratedDocument<Vod>;
export const VodSchema = SchemaFactory.createForClass(Vod);
VodSchema.index({ meetingId: 1, createdAt: -1 });
