import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @Matches(/\S/, { message: 'title must contain non-whitespace characters' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsDateString({ strict: true })
  eventDate: string;
}
