import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MediaState, Role } from 'src/libs/enums/enums';


export class ParticipantUpdateInput {
  @IsOptional() @IsEnum(Role)
  role?: Role;

  @IsOptional() @IsString()
  displayName?: string;

  // NEW: let server accept either self or moderator changes
  @IsOptional() @IsEnum(MediaState)
  micState?: MediaState;        // e.g., MUTED_BY_HOST

  @IsOptional() @IsEnum(MediaState)
  cameraState?: MediaState;     // e.g., OFF_BY_ADMIN
}
