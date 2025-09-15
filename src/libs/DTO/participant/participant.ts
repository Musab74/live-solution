import { MediaState, Role } from "src/libs/enums/enums";
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class ParticipantDto {
  @Field(() => ID)
  id!: string;
  
  @Field(() => ID)
  meetingId!: string;
  
  @Field(() => ID)
  userId!: string;
  
  @Field()
  displayName!: string;
  
  @Field()
  role!: Role;

  // NEW: live media states (reflect forced states too)
  @Field()
  micState!: MediaState;        // ON | OFF | MUTED | MUTED_BY_HOST
  
  @Field()
  cameraState!: MediaState;     // ON | OFF | OFF_BY_ADMIN

  @Field({ nullable: true })
  joinedAt?: string;            // ISO
  
  @Field({ nullable: true })
  leftAt?: string;              // ISO
  
  @Field({ nullable: true })
  totalDurationSec?: number;
}
