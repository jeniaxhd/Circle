import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCircleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}