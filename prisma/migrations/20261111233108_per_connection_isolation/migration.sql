-- AlterTable
ALTER TABLE "KnowMeEntry" ADD COLUMN     "visibleTo" TEXT[];

-- AlterTable
ALTER TABLE "WallPost" ADD COLUMN     "visibleTo" TEXT[];

-- CreateTable
CREATE TABLE "ConnectionPreference" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tonePreference" TEXT NOT NULL DEFAULT 'warm_and_gentle',

    CONSTRAINT "ConnectionPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionPreference_connectionId_userId_key" ON "ConnectionPreference"("connectionId", "userId");

-- AddForeignKey
ALTER TABLE "ConnectionPreference" ADD CONSTRAINT "ConnectionPreference_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionPreference" ADD CONSTRAINT "ConnectionPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
