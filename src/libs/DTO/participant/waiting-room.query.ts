import { Field, ObjectType, ID } from '@nestjs/graphql';
import { ParticipantStatus } from '../../enums/enums';

@ObjectType()
export class DeviceTestResult {
  @Field()
  deviceType!: string;

  @Field()
  isWorking!: boolean;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field({ nullable: true })
  deviceName?: string;

  @Field({ nullable: true })
  volumeLevel?: number; // For microphone/speaker
}

@ObjectType()
export class WaitingParticipant {
  @Field(() => ID)
  _id!: string;

  @Field()
  displayName!: string;

  @Field()
  status!: string;

  @Field()
  joinedAt!: Date;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field()
  micState!: string;

  @Field()
  cameraState!: string;

  @Field({ nullable: true })
  socketId?: string;
}

@ObjectType()
export class WaitingRoomStats {
  @Field()
  totalWaiting!: number;

  @Field()
  totalApproved!: number;

  @Field()
  totalRejected!: number;

  @Field()
  totalAdmitted!: number;
}

@ObjectType()
export class WaitingRoomResponse {
  @Field()
  message!: string;

  @Field({ nullable: true })
  success?: boolean;

  @Field(() => WaitingParticipant, { nullable: true })
  participant?: WaitingParticipant;
}
