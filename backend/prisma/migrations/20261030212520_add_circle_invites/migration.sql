-- CreateTable
CREATE TABLE "CircleInvite" (
    "id" SERIAL NOT NULL,
    "circleId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CircleInvite_tokenHash_key" ON "CircleInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CircleInvite_circleId_idx" ON "CircleInvite"("circleId");

-- AddForeignKey
ALTER TABLE "CircleInvite" ADD CONSTRAINT "CircleInvite_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
