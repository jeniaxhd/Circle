import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirclesService } from '../circles/circles.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';

const authorInclude = {
  author: { select: { id: true, name: true } },
} as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circlesService: CirclesService,
  ) {}

  async create(userId: number, circleId: number, dto: CreatePostDto) {
    await this.circlesService.findCircleById(userId, circleId);

    return this.prisma.post.create({
      data: {
        authorId: userId,
        circleId,
        text: dto.text,
      },
      include: authorInclude,
    });
  }

  async findAll(userId: number, circleId: number) {
    await this.circlesService.findCircleById(userId, circleId);

    return this.prisma.post.findMany({
      where: { circleId },
      orderBy: { id: 'desc' },
      take: 50,
      include: authorInclude,
    });
  }

  async findOne(userId: number, circleId: number, postId: number) {
    await this.circlesService.findCircleById(userId, circleId);

    const post = await this.prisma.post.findFirst({
      where: { id: postId, circleId },
      include: authorInclude,
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async update(
    userId: number,
    circleId: number,
    postId: number,
    dto: UpdatePostDto,
  ) {
    const post = await this.findOne(userId, circleId, postId);

    if (post.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this post');
    }

    return this.prisma.post.update({
      where: { id: postId, circleId, authorId: userId },
      data: { text: dto.text },
      include: authorInclude,
    });
  }

  async remove(userId: number, circleId: number, postId: number) {
    const post = await this.findOne(userId, circleId, postId);

    if (post.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete this post');
    }

    await this.prisma.post.delete({
      where: { id: postId, circleId, authorId: userId },
    });
  }
}
