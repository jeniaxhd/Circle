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
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('circles/:circleId/posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(userId, circleId, postId, dto);
  }

  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.commentsService.findAll(userId, circleId, postId);
  }

  @Patch(':commentId')
  update(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(
      userId,
      circleId,
      postId,
      commentId,
      dto,
    );
  }

  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.commentsService.remove(userId, circleId, postId, commentId);
  }
}
