import { IsInt, Min } from "class-validator";

export class SubmitPollVoteDto{
    @IsInt()
    @Min(1)
    optionId: number

}