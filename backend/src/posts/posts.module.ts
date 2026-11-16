import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CirclesModule } from '../circles/circles.module.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { JobsModule } from '../jobs/jobs.module.js';

@Module({
  imports: [AuthModule, CirclesModule, StorageModule, JobsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
