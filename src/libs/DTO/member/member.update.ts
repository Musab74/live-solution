import { IsOptional, IsString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateMemberInput {
  @Field({ nullable: true })
  @IsOptional() 
  @IsString() 
  displayName?: string;
  
  @Field({ nullable: true })
  @IsOptional() 
  @IsString() 
  avatarUrl?: string;
  
  @Field({ nullable: true })
  @IsOptional() 
  @IsString() 
  department?: string;
  
  @Field({ nullable: true })
  @IsOptional() 
  @IsString() 
  phone?: string;
  
  @Field({ nullable: true })
  @IsOptional() 
  @IsString() 
  language?: string;
  
  @Field({ nullable: true })
  @IsOptional() 
  @IsString() 
  timezone?: string;
}
