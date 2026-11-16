import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PostsService } from './posts.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { ListPostsDto } from './dto/list-posts.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { Multer } from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('circles/:circleId/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.create(userId, circleId, dto);
  }

  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Query() dto: ListPostsDto,
  ) {
    return this.postsService.findAll(userId, circleId, dto);
  }

  @Get(':postId')
  findOne(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.postsService.findOne(userId, circleId, postId);
  }

  @Patch(':postId')
  update(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(userId, circleId, postId, dto);
  }

  @Delete(':postId')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.postsService.remove(userId, circleId, postId);
  }

  @Post(':postId/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @CurrentUserId() userId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /^image\/(jpeg|png)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.postsService.uploadImage(userId, postId, circleId, file);
  }

  @Get(':postId/image')
  getImage(
    @CurrentUserId() userId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ){
    return this.postsService.getImage(userId, postId, circleId);
  }

  @Delete(':postId/image')
  @HttpCode(204)
  removeImage(
    @CurrentUserId() userId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('circleId', ParseIntPipe) circleId: number,
  ){
    return this.postsService.removeImage(userId, postId, circleId);
  }

}
