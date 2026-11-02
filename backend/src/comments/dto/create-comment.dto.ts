import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Matches(/\S/, { message: 'text must contain non-whitespace characters' })
  @MaxLength(2000)
  text: string;
}
