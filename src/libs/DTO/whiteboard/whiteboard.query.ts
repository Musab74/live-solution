import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class WhiteboardStatusResponse {
  @Field()
  isActive!: boolean;

  @Field(() => ID)
  hostId!: string;

  @Field({ nullable: true })
  startedAt?: Date;
}

