import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCircleDto } from './dto/create-circle.dto.js';
import { UpdateCircleDto } from './dto/update-circle.dto.js';
import { createHash, randomBytes } from 'node:crypto';
import { CreateCircleInviteDto } from './dto/create-circle-invite.dto.js';
import { Prisma } from '../generated/prisma/client.js';

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
    if (member == null) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  async changeMemberRole(
    userId: number,
    circleId: number,
    memberId: number,
    role: 'ADMIN' | 'MEMBER',
  ) {
    const actor = await this.requireMembership(userId, circleId);
    if (actor.role !== 'OWNER') {
      throw new ForbiddenException('Only the owner can change member roles');
    }
    const member = await this.requireMembership(memberId, circleId);
    if (member.role === 'OWNER') {
      throw new ConflictException(
        'Ownership cannot be changed through member roles',
      );
    }
    return this.prisma.circleMembership.update({
      where: {
        userId_circleId: { userId: memberId, circleId },
        role: { not: 'OWNER' },
      },
      data: { role },
      select: { userId: true, role: true, joinedAt: true },
    });
  }

  async removeMember(userId: number, circleId: number, memberId: number) {
    const actor = await this.requireMembership(userId, circleId);
    if (actor.role === 'MEMBER') {
      throw new ForbiddenException('Insufficient permissions');
    }
    const member = await this.requireMembership(memberId, circleId);
    if (member.role === 'OWNER') {
      throw new ConflictException('The owner cannot be removed');
    }
    if (actor.role === 'ADMIN' && member.role !== 'MEMBER') {
      throw new ForbiddenException('Admins can only remove regular members');
    }
    const result = await this.prisma.circleMembership.deleteMany({
      where: {
        userId: memberId,
        circleId,
        role: actor.role === 'ADMIN' ? 'MEMBER' : { not: 'OWNER' },
      },
    });
    if (result.count === 0) {
      throw new ConflictException('Membership changed; refresh and try again');
    }
  }

  async leaveCircle(userId: number, circleId: number) {
    const member = await this.requireMembership(userId, circleId);
    if (member.role === 'OWNER') {
      throw new ConflictException('The owner cannot leave their circle');
    }
    const result = await this.prisma.circleMembership.deleteMany({
      where: { userId, circleId, role: { not: 'OWNER' } },
    });
    if (result.count === 0) {
      throw new ConflictException('Membership changed; refresh and try again');
    }
  }

  async searchPosts(userId: number, circleId: number, query: string) {
    await this.requireMembership(userId, circleId);
    const text = query.trim().replace(/[\\%_]/g, '\\$&');

    return this.prisma.post.findMany({
      where: {
        circleId,
        text: { contains: text, mode: 'insensitive' },
      },
      orderBy: { id: 'desc' },
      take: 50,
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async findInvites(userId: number, circleId: number) {
    const membership = await this.requireMembership(userId, circleId);

    if (membership.role === 'MEMBER') {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.prisma.circleInvite.findMany({
      where: { circleId },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        maxUses: true,
        uses: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeInvite(userId: number, circleId: number, inviteId: number) {
    const membership = await this.requireMembership(userId, circleId);

    if (membership.role === 'MEMBER') {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.prisma.circleInvite.updateMany({
      where: { id: inviteId, circleId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const invite = await this.prisma.circleInvite.findFirst({
      where: { id: inviteId, circleId },
      select: {
        id: true,
        maxUses: true,
        uses: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }

    return invite;
  }

  async createInvite(
    circleId: number,
    userId: number,
    dto: CreateCircleInviteDto,
  ) {
    const membership = await this.requireMembership(userId, circleId);

    if (membership.role == 'MEMBER') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const hours = dto.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const maxUses = dto.maxUses ?? 1;

    const invite = await this.prisma.circleInvite.create({
      data: {
        circleId,
        tokenHash,
        maxUses,
        expiresAt,
      },
    });
    return {
      id: invite.id,
      token,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(userId: number, token: string) {
    const hashedToken = createHash('sha256').update(token).digest('hex');

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const invite = await tx.circleInvite.findUnique({
            where: { tokenHash: hashedToken },
          });

          if (!invite) {
            throw new NotFoundException('Invitation not found');
          }
          const existingMembership = await tx.circleMembership.findUnique({
            where: {
              userId_circleId: {
                userId,
                circleId: invite.circleId,
              },
            },
          });

          if (existingMembership) {
            throw new ConflictException('Already a circle member');
          }

          const result = await tx.circleInvite.updateMany({
            where: {
              id: invite.id,
              revokedAt: null,
              expiresAt: { gt: new Date() },
              uses: {
                lt: tx.circleInvite.fields.maxUses,
              },
            },
            data: {
              uses: { increment: 1 },
            },
          });

          if (result.count === 0) {
            throw new NotFoundException('Invite is unavailable');
          }

          const membership = await tx.circleMembership.create({
            data: {
              userId,
              circleId: invite.circleId,
            },
          });
          return membership;
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Already a circle member');
      }

      throw error;
    }
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
