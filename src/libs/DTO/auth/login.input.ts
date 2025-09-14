import { IsEmail, IsString } from 'class-validator';

export class LoginInput {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
