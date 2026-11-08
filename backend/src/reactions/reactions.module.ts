import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PostsModule } from "../posts/posts.module.js";
import { ReactionsController } from "./reactions.controller.js";
import { ReactionsService } from "./reactions.service.js";

@Module({
  imports: [AuthModule, PostsModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}