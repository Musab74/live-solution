import { ObjectType, Field, ID } from '@nestjs/graphql';
import { MeetingStatus } from '../../enums/enums';

@ObjectType()
export class MeetingDto {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  status!: MeetingStatus;

  @Field(() => ID)
  hostId!: string;

  @Field()
  inviteCode!: string;

  @Field({ nullable: true })
  isPrivate?: boolean;

  @Field({ nullable: true })
  scheduledStartAt?: Date;

  @Field({ nullable: true })
  actualStartAt?: Date;

  @Field({ nullable: true })
  endedAt?: Date;

  @Field({ nullable: true })
  durationMin?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  participantCount!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}