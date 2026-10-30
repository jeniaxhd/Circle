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
import { CirclesService } from './circles.service.js';
import { CreateCircleDto } from './dto/create-circle.dto.js';
import { UpdateCircleDto } from './dto/update-circle.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('circles')
export class CirclesController {
  constructor(private readonly circlesService: CirclesService) {}

  @Post()
  create(@CurrentUserId() userId: number, @Body() dto: CreateCircleDto) {
    return this.circlesService.create(userId, dto);
  }
  @Get()
  findMine(@CurrentUserId() userId: number) {
    return this.circlesService.findMine(userId);
  }
  @Get(':circleId')
  find(
    @Param('circleId', ParseIntPipe) circleId: number,
    @CurrentUserId() userId: number,
  ) {
    return this.circlesService.findCircleById(userId, circleId);
  }
  @Get(':circleId/members')
  findMembers(
    @Param('circleId', ParseIntPipe) circleId: number,
    @CurrentUserId() userId: number,
  ) {
    return this.circlesService.findMembers(userId, circleId);
  }
  @Patch(':circleId')
  update(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Body() dto: UpdateCircleDto,
  ) {
    return this.circlesService.update(userId, circleId, dto);
  }

  @Delete(':circleId')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ) {
    return this.circlesService.remove(userId, circleId);
  }

  @Get(':circleId/members/:memberId')
  findMember(
    @Param('circleId', ParseIntPipe) circleId: number, 
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUserId() userId: number
  ) {
      return this.circlesService.findMember(userId, memberId, circleId)
  }
}
