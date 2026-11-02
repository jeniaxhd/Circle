import { IsString, Matches, MaxLength } from 'class-validator';

export class SearchCircleDto {
  @IsString()
  @Matches(/\S/, { message: 'q must contain non-whitespace characters' })
  @MaxLength(200)
  q: string;
}
