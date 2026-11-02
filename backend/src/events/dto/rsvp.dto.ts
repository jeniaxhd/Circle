import { IsIn } from 'class-validator';

export class RsvpDto {
  @IsIn(['GOING', 'MAYBE', 'NOT_GOING'])
  status: 'GOING' | 'MAYBE' | 'NOT_GOING';
}
