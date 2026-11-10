-- AlterTable
ALTER TABLE "TopicDefault" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sanitizedLabel" TEXT;

