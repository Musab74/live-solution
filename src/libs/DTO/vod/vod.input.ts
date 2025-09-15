import { IsOptional, IsString, IsEnum, IsUrl, IsInt, Min, MaxLength } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { VodSourceType } from '../../enums/enums';

@InputType()
export class CreateVodFileInput {
  @Field()
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  meetingId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number;
}

@InputType()
export class CreateVodUrlInput {
  @Field()
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field()
  @IsUrl()
  url!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  meetingId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number;
}

@InputType()
export class UpdateVodInput {
  @Field()
  @IsString()
  vodId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number;
}

@InputType()
export class VodQueryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  q?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(VodSourceType)
  source?: VodSourceType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  meetingId?: string;

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