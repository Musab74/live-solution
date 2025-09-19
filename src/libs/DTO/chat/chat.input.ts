import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ChatHistoryInput {
  @Field()
  @IsMongoId()
  meetingId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  before?: string; // messageId for pagination

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

@InputType()
export class ChatSearchInput {
  @Field()
  @IsMongoId()
  meetingId!: string;

  @Field()
  @IsString()
  @MaxLength(200)
  q!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

@InputType()
export class DeleteMessageInput {
  @Field()
  @IsMongoId()
  messageId!: string;
}
