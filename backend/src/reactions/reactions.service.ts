import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PostsService } from '../posts/posts.service.js';
import { CreateReactionDto } from './dto/create-reaction.dto.js';

const authorInclude = {
  author: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postService: PostsService,
  ) {}

  async upsert(
    userId: number,
    postId: number,
    dto: CreateReactionDto,
    circleId: number,
  ) {
    await this.postService.findOne(userId, circleId, postId);

    return this.prisma.reaction.upsert({
      where: {
        postId_authorId: { authorId: userId, postId },
      },
      create: {
        authorId: userId,
        postId,
        emoji: dto.emoji,
      },
      update: {
        emoji: dto.emoji,
      },
    });
  }

  async findAll(userId: number, circleId: number, postId: number) {
    await this.postService.findOne(userId, circleId, postId);

    const reactions = await this.prisma.reaction.groupBy({
      by: ['emoji'],
      where: { postId },
      _count: {
        _all: true,
      },
    });
    const myReaction = await this.prisma.reaction.findUnique({
      where: {
        postId_authorId: { postId, authorId: userId },
      },
      select: { id: true, emoji: true },
    });

    return { reactions, myReaction };
  }

  async delete(
    userId: number,
    circleId: number,
    postId: number,
    reactionId: number,
  ) {
    await this.postService.findOne(userId, circleId, postId);

    const reaction = await this.prisma.reaction.findFirst({
      where: { authorId: userId, id: reactionId, postId },
    });
    if (!reaction) {
      throw new NotFoundException('Reaction is not found');
    }
    return this.prisma.reaction.delete({
      where: { authorId: userId, id: reactionId, postId },
    });
  }
}
