import { IsString } from 'class-validator';

export class InviteInput {
  @IsString({ each: true }) emails!: string[];
}
