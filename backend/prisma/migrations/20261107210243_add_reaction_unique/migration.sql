/*
  Warnings:

  - A unique constraint covering the columns `[postId,authorId]` on the table `Reaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Reaction_id_postId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_postId_authorId_key" ON "Reaction"("postId", "authorId");
