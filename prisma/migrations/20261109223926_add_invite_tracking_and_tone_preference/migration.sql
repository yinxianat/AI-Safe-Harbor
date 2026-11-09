-- AlterTable
ALTER TABLE "MagicToken" ADD COLUMN     "invitedByUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tonePreference" TEXT NOT NULL DEFAULT 'warm_and_gentle';

-- AddForeignKey
ALTER TABLE "MagicToken" ADD CONSTRAINT "MagicToken_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
