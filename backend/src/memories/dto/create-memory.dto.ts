import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateMemoryDto {
  @IsString()
  @Matches(/\S/, { message: 'title must contain non-whitespace characters' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  text?: string | null;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsDateString({ strict: true })
  occurredAt: string;
}
