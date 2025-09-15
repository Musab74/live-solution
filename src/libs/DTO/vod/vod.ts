import { ObjectType, Field, ID } from '@nestjs/graphql';
import { VodSourceType } from '../../enums/enums';

@ObjectType()
export class VodDto {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => ID, { nullable: true })
  meetingId?: string;

  @Field()
  source!: VodSourceType;

  @Field({ nullable: true })
  storageKey?: string;

  @Field({ nullable: true })
  sizeBytes?: number;

  @Field({ nullable: true })
  url?: string;

  @Field({ nullable: true })
  durationSec?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}