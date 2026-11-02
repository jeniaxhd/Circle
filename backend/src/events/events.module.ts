import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CirclesModule } from '../circles/circles.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [AuthModule, CirclesModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
