import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirclesService } from '../circles/circles.service.js';
import { CreateMemoryDto } from './dto/create-memory.dto.js';
import { UpdateMemoryDto } from './dto/update-memory.dto.js';

const authorInclude = { author: { select: { id: true, name: true } } } as const;

@Injectable()
export class MemoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circlesService: CirclesService,
  ) {}

  async create(userId: number, circleId: number, dto: CreateMemoryDto) {
    await this.circlesService.findCircleById(userId, circleId);
    return this.prisma.memory.create({
      data: {
        circleId,
        authorId: userId,
        title: dto.title,
        text: dto.text,
        imageUrl: dto.imageUrl,
        occurredAt: new Date(dto.occurredAt),
      },
      include: authorInclude,
    });
  }

  async findAll(userId: number, circleId: number) {
    await this.circlesService.findCircleById(userId, circleId);
    return this.prisma.memory.findMany({
      where: { circleId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: authorInclude,
    });
  }

  async findOne(userId: number, circleId: number, memoryId: number) {
    await this.circlesService.findCircleById(userId, circleId);
    const memory = await this.prisma.memory.findFirst({
      where: { id: memoryId, circleId },
      include: authorInclude,
    });
    if (!memory) {
      throw new NotFoundException('Memory not found');
    }
    return memory;
  }

  async update(
    userId: number,
    circleId: number,
    memoryId: number,
    dto: UpdateMemoryDto,
  ) {
    const memory = await this.findOne(userId, circleId, memoryId);
    if (memory.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this memory');
    }
    return this.prisma.memory.update({
      where: { id: memoryId, circleId, authorId: userId },
      data: {
        title: dto.title,
        text: dto.text,
        imageUrl: dto.imageUrl,
        occurredAt:
          dto.occurredAt === undefined ? undefined : new Date(dto.occurredAt),
      },
      include: authorInclude,
    });
  }

  async remove(userId: number, circleId: number, memoryId: number) {
    const memory = await this.findOne(userId, circleId, memoryId);
    if (memory.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete this memory');
    }
    await this.prisma.memory.delete({
      where: { id: memoryId, circleId, authorId: userId },
    });
  }
}
