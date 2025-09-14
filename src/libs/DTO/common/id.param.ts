import { IsMongoId, IsUUID } from 'class-validator';

export class ObjectIdParamDto {
  @IsMongoId()
  id!: string;
}

export class UuidParamDto {
  @IsUUID()
  id!: string;
}
