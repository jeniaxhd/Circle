import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirclesService } from '../circles/circles.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { RsvpDto } from './dto/rsvp.dto.js';

const authorInclude = { author: { select: { id: true, name: true } } } as const;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circlesService: CirclesService,
  ) {}

  async create(userId: number, circleId: number, dto: CreateEventDto) {
    await this.circlesService.findCircleById(userId, circleId);
    return this.prisma.event.create({
      data: {
        circleId,
        authorId: userId,
        title: dto.title,
        description: dto.description,
        eventDate: new Date(dto.eventDate),
      },
      include: authorInclude,
    });
  }

  async findAll(userId: number, circleId: number) {
    await this.circlesService.findCircleById(userId, circleId);
    return this.prisma.event.findMany({
      where: { circleId },
      orderBy: [{ eventDate: 'desc' }, { id: 'desc' }],
      take: 50,
      include: authorInclude,
    });
  }

  async findOne(userId: number, circleId: number, eventId: number) {
    await this.circlesService.findCircleById(userId, circleId);
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, circleId },
      include: authorInclude,
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async update(
    userId: number,
    circleId: number,
    eventId: number,
    dto: UpdateEventDto,
  ) {
    const event = await this.findOne(userId, circleId, eventId);
    if (event.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this event');
    }
    return this.prisma.event.update({
      where: { id: eventId, circleId, authorId: userId },
      data: {
        title: dto.title,
        description: dto.description,
        eventDate:
          dto.eventDate === undefined ? undefined : new Date(dto.eventDate),
      },
      include: authorInclude,
    });
  }

  async remove(userId: number, circleId: number, eventId: number) {
    const event = await this.findOne(userId, circleId, eventId);
    if (event.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete this event');
    }
    await this.prisma.event.delete({
      where: { id: eventId, circleId, authorId: userId },
    });
  }

  async setRsvp(
    userId: number,
    circleId: number,
    eventId: number,
    dto: RsvpDto,
  ) {
    await this.findOne(userId, circleId, eventId);
    return this.prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: dto.status },
      update: { status: dto.status },
    });
  }

  async removeRsvp(userId: number, circleId: number, eventId: number) {
    await this.findOne(userId, circleId, eventId);
    await this.prisma.eventAttendee.deleteMany({ where: { eventId, userId } });
  }

  async findAttendees(userId: number, circleId: number, eventId: number) {
    await this.findOne(userId, circleId, eventId);
    return this.prisma.eventAttendee.findMany({
      where: { eventId },
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        userId: true,
        status: true,
        user: { select: { id: true, name: true } },
      },
    });
  }
}
