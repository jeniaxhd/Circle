import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Query,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CirclesService } from './circles.service.js';
import { CreateCircleDto } from './dto/create-circle.dto.js';
import { UpdateCircleDto } from './dto/update-circle.dto.js';
import { CreateCircleInviteDto } from './dto/create-circle-invite.dto.js';
import { SearchCircleDto } from './dto/search-circle.dto.js';
import { ChangeCircleRoleDto } from './dto/change-circle-role.dto.js';

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
    @CurrentUserId() userId: number,
  ) {
    return this.circlesService.findMember(userId, memberId, circleId);
  }

  @Patch(':circleId/members/:memberId')
  changeMemberRole(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: ChangeCircleRoleDto,
  ) {
    return this.circlesService.changeMemberRole(
      userId,
      circleId,
      memberId,
      dto.role,
    );
  }

  @Delete(':circleId/members/:memberId')
  @HttpCode(204)
  removeMember(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.circlesService.removeMember(userId, circleId, memberId);
  }

  @Delete(':circleId/membership')
  @HttpCode(204)
  leaveCircle(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ) {
    return this.circlesService.leaveCircle(userId, circleId);
  }

  @Get(':circleId/search')
  searchPosts(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Query() dto: SearchCircleDto,
  ) {
    return this.circlesService.searchPosts(userId, circleId, dto.q);
  }

  @Get(':circleId/invites')
  findInvites(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ) {
    return this.circlesService.findInvites(userId, circleId);
  }

  @Patch(':circleId/invites/:inviteId/revoke')
  revokeInvite(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
  ) {
    return this.circlesService.revokeInvite(userId, circleId, inviteId);
  }

  @Post(':circleId/invites')
  createInvite(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Body() dto: CreateCircleInviteDto,
  ) {
    return this.circlesService.createInvite(circleId, userId, dto);
  }
}
