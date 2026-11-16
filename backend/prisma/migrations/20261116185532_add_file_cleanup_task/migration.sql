-- CreateTable
CREATE TABLE "FileCleanupTask" (
    "id" SERIAL NOT NULL,
    "imageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "FileCleanupTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileCleanupTask_dispatchedAt_idx" ON "FileCleanupTask"("dispatchedAt");
