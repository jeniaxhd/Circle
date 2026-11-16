import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { StorageService } from "../storage/storage.service.js";

@Processor('file-cleanup')
export class FileCleanupProcessor extends WorkerHost{

    constructor(
            private readonly storageService: StorageService
        ) {
        super();
    }

    async process(
        job: Job<{ imageKey: string }>
    ){
        const key = job.data.imageKey

        await this.storageService.deleteImage(key)
    }
}