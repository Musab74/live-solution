import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional() @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) pageSize?: number = 20;
  @IsOptional() @IsString() search?: string; // 검색어
  @IsOptional() @IsString() sort?: string; // e.g. "createdAt:desc"
}
