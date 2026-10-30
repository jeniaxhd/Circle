import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCircleDto } from './dto/create-circle.dto.js';
import { UpdateCircleDto } from './dto/update-circle.dto.js';

@Injectable()
export class CirclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: number, dto: CreateCircleDto) {
    return this.prisma.circle.create({
      data: {
        name: dto.name,
        description: dto.description,
        memberships: {
          create: { userId, role: 'OWNER' },
        },
      },
    });
  }
  findMine(userId: number) {
    return this.prisma.circle.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { id: 'desc' },
    });
  }
  async findCircleById(userId: number, circleId: number) {
    const circle = await this.prisma.circle.findFirst({
      where: {
        id: circleId,
        memberships: { some: { userId } },
      },
    });

    if (!circle) {
      throw new NotFoundException();
    }

    return circle;
  }

  async findMembers(userId: number, circleId: number) {
    await this.findCircleById(userId, circleId);

    return this.prisma.circleMembership.findMany({
      where: { circleId },
      select: {
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
  async update(userId: number, circleId: number, dto: UpdateCircleDto) {
    const membership = await this.requireMembership(userId, circleId);

    if (membership.role === 'MEMBER') {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.prisma.circle.update({
      where: { id: circleId },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async remove(userId: number, circleId: number) {
    const membership = await this.requireMembership(userId, circleId);

    if (membership.role !== 'OWNER') {
      throw new ForbiddenException('Only owner can delete the circle');
    }

    await this.prisma.circle.delete({
      where: { id: circleId },
    });
  }

  async findMember(userId: number, memberId: number, circleId: number) {
    await this.requireMembership(userId, circleId);

    const member = await this.prisma.circleMembership.findFirst({
      where: { circleId, userId: memberId },
      select: {
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if(member == null) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  private async requireMembership(userId: number, circleId: number) {
    const membership = await this.prisma.circleMembership.findUnique({
      where: {
        userId_circleId: {
          userId,
          circleId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException();
    }

    return membership;
  }
}
