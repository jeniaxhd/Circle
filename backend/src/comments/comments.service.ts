import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PostsService } from '../posts/posts.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';

const authorInclude = {
  author: { select: { id: true, name: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
  ) {}

  async create(
    userId: number,
    circleId: number,
    postId: number,
    dto: CreateCommentDto,
  ) {
    await this.postsService.findOne(userId, circleId, postId);

    return this.prisma.comment.create({
      data: { postId, authorId: userId, text: dto.text },
      include: authorInclude,
    });
  }

  async findAll(userId: number, circleId: number, postId: number) {
    await this.postsService.findOne(userId, circleId, postId);

    return this.prisma.comment.findMany({
      where: { postId },
      orderBy: { id: 'desc' },
      take: 50,
      include: authorInclude,
    });
  }

  async update(
    userId: number,
    circleId: number,
    postId: number,
    commentId: number,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.findOne(userId, circleId, postId, commentId);
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }

    return this.prisma.comment.update({
      where: { id: commentId, postId, authorId: userId },
      data: { text: dto.text },
      include: authorInclude,
    });
  }

  async remove(
    userId: number,
    circleId: number,
    postId: number,
    commentId: number,
  ) {
    const comment = await this.findOne(userId, circleId, postId, commentId);
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete this comment');
    }

    await this.prisma.comment.delete({
      where: { id: commentId, postId, authorId: userId },
    });
  }

  private async findOne(
    userId: number,
    circleId: number,
    postId: number,
    commentId: number,
  ) {
    await this.postsService.findOne(userId, circleId, postId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }
}
