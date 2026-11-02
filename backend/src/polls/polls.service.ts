import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirclesService } from '../circles/circles.service.js';
import { CreatePollDto } from './dto/create-poll.dto.js';
import { UpdatePollDto } from './dto/update-poll.dto.js';
import { SubmitPollVoteDto } from './dto/submit-poll-vote.dto.js';
import { Prisma } from '../generated/prisma/client.js';

const pollInclude = {
  author: { select: { id: true, name: true } },
  pollOptions: {
    orderBy: { id: 'asc' },
    select: { id: true, title: true, _count: { select: { votes: true } } },
  },
  _count: { select: { votes: true } },
} as const;

@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circlesService: CirclesService,
  ) {}

  async create(userId: number, circleId: number, dto: CreatePollDto) {
    await this.circlesService.findCircleById(userId, circleId);
    const options = dto.options.map((title) => title.trim());
    if (
      new Set(options.map((title) => title.toLowerCase())).size !==
      options.length
    ) {
      throw new BadRequestException('Poll options must be distinct');
    }
    const closesAt = dto.closesAt == null ? null : new Date(dto.closesAt);
    if (closesAt && closesAt.getTime() <= Date.now()) {
      throw new BadRequestException('closesAt must be in the future');
    }
    return this.prisma.poll.create({
      data: {
        circleId,
        authorId: userId,
        title: dto.title.trim(),
        closesAt,
        pollOptions: { create: options.map((title) => ({ title })) },
      },
      include: pollInclude,
    });
  }

  async findAll(userId: number, circleId: number) {
    await this.circlesService.findCircleById(userId, circleId);
    return this.prisma.poll.findMany({
      where: { circleId },
      orderBy: { id: 'desc' },
      take: 50,
      include: pollInclude,
    });
  }

  async findOne(userId: number, circleId: number, pollId: number) {
    await this.circlesService.findCircleById(userId, circleId);
    const poll = await this.prisma.poll.findFirst({
      where: { id: pollId, circleId },
      include: pollInclude,
    });
    if (!poll) {
      throw new NotFoundException('Poll not found');
    }
    return poll;
  }

  async update(
    userId: number,
    circleId: number,
    pollId: number,
    dto: UpdatePollDto,
  ) {
    const poll = await this.findOne(userId, circleId, pollId);
    if (poll.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this poll');
    }
    return this.prisma.poll.update({
      where: { id: pollId, circleId, authorId: userId },
      data: { title: dto.title.trim() },
      include: pollInclude,
    });
  }

  async close(userId: number, circleId: number, pollId: number) {
    const poll = await this.findOne(userId, circleId, pollId);
    if (poll.authorId !== userId) {
      throw new ForbiddenException('Only the author can close this poll');
    }
    const now = new Date();
    await this.prisma.poll.updateMany({
      where: {
        id: pollId,
        circleId,
        authorId: userId,
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
      data: { closesAt: now },
    });
    return this.findOne(userId, circleId, pollId);
  }

  async remove(userId: number, circleId: number, pollId: number) {
    const poll = await this.findOne(userId, circleId, pollId);
    if (poll.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete this poll');
    }
    await this.prisma.poll.delete({
      where: { id: pollId, circleId, authorId: userId },
    });
  }

  async vote(
    userId: number,
    circleId: number,
    pollId: number,
    dto: SubmitPollVoteDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const membership = await tx.circleMembership.findUnique({
            where: {
              userId_circleId: {
                userId,
                circleId,
              },
            },
          });
          if (!membership) {
            throw new NotFoundException('Circle not found');
          }

          const [poll] = await tx.$queryRaw<
            Array<{ id: number; closesAt: Date | null }>
          >`
          SELECT "id", "closesAt"
          FROM "Poll"
          WHERE "id" = ${pollId}
          AND "circleId" = ${circleId}
          FOR UPDATE`;

          if (!poll) {
            throw new NotFoundException('Poll not found');
          }

          if (poll.closesAt !== null && poll.closesAt.getTime() <= Date.now()) {
            throw new ConflictException('Poll is closed');
          }
          const optionId = dto.optionId;
          const option = await tx.pollOption.findFirst({
            where: {
              id: dto.optionId,
              pollId,
            },
          });
          if (!option) {
            throw new NotFoundException('Option not found');
          }

          const vote = await tx.pollVote.create({
            data: {
              pollId,
              optionId,
              userId,
            },
          });
          return vote;
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Already voted');
      }
      throw error;
    }
  }
}
