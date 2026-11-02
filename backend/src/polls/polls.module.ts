import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CirclesModule } from '../circles/circles.module.js';
import { PollsController } from './polls.controller.js';
import { PollsService } from './polls.service.js';

@Module({
  imports: [AuthModule, CirclesModule],
  controllers: [PollsController],
  providers: [PollsService],
})
export class PollsModule {}
