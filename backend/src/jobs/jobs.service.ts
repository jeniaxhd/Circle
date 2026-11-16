import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

@Injectable()
export class JobsService{
    constructor(
        @InjectQueue('file-cleanup')
        private readonly fileQueue: Queue,
    ) {}

    
    removeImage(
        imageKey: string
    ){
        const key = {imageKey}
        return this.fileQueue.add('delete-image', key, {backoff: {delay: 2000,  type: 'exponential',}, attempts: 5})
    }

}