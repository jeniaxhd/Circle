import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { RsvpDto } from './dto/rsvp.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('circles/:circleId/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(userId, circleId, dto);
  }

  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ) {
    return this.eventsService.findAll(userId, circleId);
  }

  @Get(':eventId')
  findOne(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.eventsService.findOne(userId, circleId, eventId);
  }

  @Patch(':eventId')
  update(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(userId, circleId, eventId, dto);
  }

  @Delete(':eventId')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.eventsService.remove(userId, circleId, eventId);
  }

  @Put(':eventId/rsvp')
  setRsvp(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: RsvpDto,
  ) {
    return this.eventsService.setRsvp(userId, circleId, eventId, dto);
  }

  @Delete(':eventId/rsvp')
  @HttpCode(204)
  removeRsvp(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.eventsService.removeRsvp(userId, circleId, eventId);
  }

  @Get(':eventId/attendees')
  findAttendees(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.eventsService.findAttendees(userId, circleId, eventId);
  }
}
