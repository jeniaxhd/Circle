import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirclesService } from '../circles/circles.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { ListPostsDto } from './dto/list-posts.dto.js';
import type { Post } from '../generated/prisma/client.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { JobsService } from '../jobs/jobs.service.js';

const authorInclude = {
  author: { select: { id: true, name: true } },
} as const;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly circlesService: CirclesService,
    private readonly storageService: StorageService,
    private readonly jobsService: JobsService,
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

  async findAll(userId: number, circleId: number, dto: ListPostsDto) {
    await this.circlesService.findCircleById(userId, circleId);

    const posts = await this.prisma.post.findMany({
      where: {
        circleId,
        id: dto.cursor === undefined ? undefined : { lt: dto.cursor },
      },
      orderBy: { id: 'desc' },
      take: dto.limit + 1,
      include: authorInclude,
    });

    const hasMore = posts.length > dto.limit;
    const items = posts.slice(0, dto.limit);

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
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

    if (post.imageKey !== null) {
       await this.jobsService.removeImage(post.imageKey)
    }
  }

  async uploadImage(
    userId: number,
    postId: number,
    circleId: number,
    file: Express.Multer.File,
  ) {
    const post = await this.findOne(userId, circleId, postId);

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the author can upload image to this post',
      );
    }

    const oldKey = post.imageKey;
    const newKey = await this.storageService.uploadImage(
      file.buffer,
      file.mimetype,
    );

    let updated: Post;
    try {
      updated = await this.prisma.post.update({
        where: { authorId: userId, id: postId, circleId },
        data: { imageKey: newKey },
      });
    } catch (error) {
      try {
         await this.jobsService.removeImage(newKey)
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clean up unattached image ${newKey}`,
          cleanupError,
        );
      }
      throw error;
    }

    if (oldKey !== null) {
       await this.jobsService.removeImage(oldKey)
    }

    return updated;
  }

  async removeImage(userId: number, postId: number, circleId: number){
    const post = await this.findOne(userId, circleId, postId);
    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the author can remove image from this post',
      );
    }
    if (!post.imageKey){
      throw new NotFoundException('The post has no image')
    }
      await this.prisma.post.update({
        where: { authorId: userId, id: postId, circleId },
        data: { imageKey: null },
      });

      await this.jobsService.removeImage(post.imageKey)
    
  }

  async getImage(userId: number, postId: number, circleId: number) {
    const post = await this.findOne(userId, circleId, postId);
    if (!post.imageKey) {
      throw new NotFoundException('Image is not found');
    }

    return this.storageService.getImage(post.imageKey);
  }
}
