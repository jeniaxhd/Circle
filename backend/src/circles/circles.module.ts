import { Module } from '@nestjs/common';
import { CirclesController } from './circles.controller.js';
import { CirclesService } from './circles.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { InvitesController } from './invites.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [CirclesController, InvitesController],
  providers: [CirclesService],
  exports: [CirclesService],
})
export class CirclesModule {}
