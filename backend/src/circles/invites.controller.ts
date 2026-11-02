import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { CirclesService } from './circles.service.js';

@Controller('/invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly circlesService: CirclesService) {}
  @Post(':token/accept')
  acceptInvite(@Param('token') token: string, @CurrentUserId() userId: number) {
    return this.circlesService.acceptInvite(userId, token);
  }
}
