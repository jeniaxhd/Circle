import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CirclesModule } from '../circles/circles.module.js';
import { MemoriesController } from './memories.controller.js';
import { MemoriesService } from './memories.service.js';

@Module({
  imports: [AuthModule, CirclesModule],
  controllers: [MemoriesController],
  providers: [MemoriesService],
})
export class MemoriesModule {}
