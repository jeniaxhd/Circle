import { IsString, Matches, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @Matches(/\S/, { message: 'text must contain non-whitespace characters' })
  @MaxLength(5000)
  text: string;
}
