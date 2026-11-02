/*
  Warnings:

  - A unique constraint covering the columns `[id,pollId]` on the table `PollOption` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_optionId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_id_pollId_key" ON "PollOption"("id", "pollId");

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_pollId_fkey" FOREIGN KEY ("optionId", "pollId") REFERENCES "PollOption"("id", "pollId") ON DELETE CASCADE ON UPDATE CASCADE;
