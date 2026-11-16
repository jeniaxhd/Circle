import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CirclesModule } from './circles/circles.module.js';
import { PostsModule } from './posts/posts.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { EventsModule } from './events/events.module.js';
import { MemoriesModule } from './memories/memories.module.js';
import { PollsModule } from './polls/polls.module.js';
import { ReactionsModule } from './reactions/reactions.module.js';
import { StorageModule } from './storage/storage.module.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CirclesModule,
    PostsModule,
    CommentsModule,
    EventsModule,
    MemoriesModule,
    PollsModule,
    ReactionsModule,
    StorageModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
