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
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PollsService } from './polls.service.js';
import { CreatePollDto } from './dto/create-poll.dto.js';
import { UpdatePollDto } from './dto/update-poll.dto.js';
import { SubmitPollVoteDto } from './dto/submit-poll-vote.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('circles/:circleId/polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Post()
  create(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Body() dto: CreatePollDto,
  ) {
    return this.pollsService.create(userId, circleId, dto);
  }

  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ) {
    return this.pollsService.findAll(userId, circleId);
  }

  @Get(':pollId')
  findOne(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
  ) {
    return this.pollsService.findOne(userId, circleId, pollId);
  }

  @Patch(':pollId')
  update(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
    @Body() dto: UpdatePollDto,
  ) {
    return this.pollsService.update(userId, circleId, pollId, dto);
  }

  @Post(':pollId/votes')
  vote(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
    @Body() dto: SubmitPollVoteDto,
  ) {
    return this.pollsService.vote(userId, circleId, pollId, dto);
  }

  @Delete(':pollId/votes')
  removeVote(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
  ){
    return this.pollsService.removeVote(userId, circleId, pollId)
  }

  @Patch(':pollId/close')
  close(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
  ) {
    return this.pollsService.close(userId, circleId, pollId);
  }

  @Delete(':pollId')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('pollId', ParseIntPipe) pollId: number,
  ) {
    return this.pollsService.remove(userId, circleId, pollId);
  }
}
