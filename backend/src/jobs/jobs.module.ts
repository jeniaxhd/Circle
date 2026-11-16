import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service.js';
import { FileCleanupProcessor } from './file-cleanup.processor.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(
          configService.getOrThrow<string>('REDIS_URL'),
        );

        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
          },
        };
      },
    }),
    BullModule.registerQueue({
        name: 'file-cleanup',
    }),
    StorageModule
  ],
  providers:[JobsService, FileCleanupProcessor],
  exports:[JobsService]
})
export class JobsModule {}