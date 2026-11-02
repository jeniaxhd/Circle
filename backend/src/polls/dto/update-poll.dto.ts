import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdatePollDto {
  @IsString()
  @Matches(/\S/, { message: 'title must contain non-whitespace characters' })
  @MaxLength(200)
  title: string;
}
