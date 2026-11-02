import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePollDto {
  @IsString()
  @Matches(/\S/, { message: 'title must contain non-whitespace characters' })
  @MaxLength(200)
  title: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/\S/, {
    each: true,
    message: 'options must contain non-whitespace characters',
  })
  @MaxLength(200, { each: true })
  options: string[];

  @IsOptional()
  @IsDateString({ strict: true })
  closesAt?: string | null;
}
