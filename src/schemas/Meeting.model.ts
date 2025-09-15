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
  @Prop({ type: String, enum: Object.values(MeetingStatus), default: MeetingStatus.SCHEDULED, index: true })
  status!: MeetingStatus;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true, index: true })
  hostId!: Types.ObjectId;

  @Field()
  @Prop({ required: true, unique: true, index: true, trim: true })
  inviteCode!: string;

  @Field({ nullable: true })
  @Prop() passcodeHash?: string;     // if you protect rooms
  
  @Field({ nullable: true })
  @Prop() isPrivate?: boolean;

  @Field({ nullable: true })
  @Prop() scheduledStartAt?: Date;   // for 예약된 회의
  
  @Field({ nullable: true })
  @Prop() actualStartAt?: Date;      // when it really started
  
  @Field({ nullable: true })
  @Prop() endedAt?: Date;

  @Field({ nullable: true })
  @Prop() durationMin?: number;
  
  @Field({ nullable: true })
  @Prop() notes?: string;

  // denormalized count for fast lists (optional)
  @Field()
  @Prop({ default: 0 }) participantCount!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export type MeetingDocument = HydratedDocument<Meeting>;
export const MeetingSchema = SchemaFactory.createForClass(Meeting);

MeetingSchema.index({ status: 1, scheduledStartAt: -1 });
MeetingSchema.index({ hostId: 1, createdAt: -1 });
