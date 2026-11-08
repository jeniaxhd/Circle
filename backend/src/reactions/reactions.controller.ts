import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ReactionsService } from "./reactions.service.js";
import { CurrentUserId } from "../auth/current-user.decorator.js";
import { CreateReactionDto } from "./dto/create-reaction.dto.js";

@UseGuards(JwtAuthGuard)
@Controller('circles/:circleId/posts/:postId/reactions')
export class ReactionsController{
    constructor(private readonly reactionsService: ReactionsService){};

    @Post()
    create(
        @CurrentUserId(0) userId: number,
        @Param('postId', ParseIntPipe) postId:number,
        @Param('circleId', ParseIntPipe) circleId: number,
        @Body() dto: CreateReactionDto
    ){
        return this.reactionsService.upsert(userId, postId, dto, circleId);
    };

    @Delete(':reactionId')
    delete(
        @CurrentUserId(0) userId: number,
        @Param('postId', ParseIntPipe) postId:number,
        @Param('circleId', ParseIntPipe) cirlceId: number,
        @Param('reactionId', ParseIntPipe) reactionId: number,
    ){
        return this.reactionsService.delete(userId, cirlceId, postId, reactionId)
    }

    @Get()
    findAll(
        @CurrentUserId(0) userId: number,
        @Param('postId', ParseIntPipe) postId:number,
        @Param('circleId', ParseIntPipe) circleId: number,
    ){
        return this.reactionsService.findAll(userId, circleId, postId,);
    }
}