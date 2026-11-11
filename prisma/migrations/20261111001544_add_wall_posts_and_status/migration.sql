-- AlterTable
ALTER TABLE "User" ADD COLUMN     "statusMood" TEXT,
ADD COLUMN     "statusText" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WallPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mood" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WallPost_userId_createdAt_idx" ON "WallPost"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
