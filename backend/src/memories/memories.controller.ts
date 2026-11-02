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
import { MemoriesService } from './memories.service.js';
import { CreateMemoryDto } from './dto/create-memory.dto.js';
import { UpdateMemoryDto } from './dto/update-memory.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('circles/:circleId/memories')
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  @Post()
  create(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Body() dto: CreateMemoryDto,
  ) {
    return this.memoriesService.create(userId, circleId, dto);
  }

  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ) {
    return this.memoriesService.findAll(userId, circleId);
  }

  @Get(':memoryId')
  findOne(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('memoryId', ParseIntPipe) memoryId: number,
  ) {
    return this.memoriesService.findOne(userId, circleId, memoryId);
  }

  @Patch(':memoryId')
  update(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('memoryId', ParseIntPipe) memoryId: number,
    @Body() dto: UpdateMemoryDto,
  ) {
    return this.memoriesService.update(userId, circleId, memoryId, dto);
  }

  @Delete(':memoryId')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('memoryId', ParseIntPipe) memoryId: number,
  ) {
    return this.memoriesService.remove(userId, circleId, memoryId);
  }
}
