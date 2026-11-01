import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CirclesModule } from '../circles/circles.module.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [AuthModule, CirclesModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
