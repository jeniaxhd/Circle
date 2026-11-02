import { IsIn } from 'class-validator';

export class ChangeCircleRoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}
