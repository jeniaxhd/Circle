import { Module } from '@nestjs/common';
import { CirclesController } from './circles.controller.js';
import { CirclesService } from './circles.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [CirclesController],
  providers: [CirclesService]
})
export class CirclesModule {}
