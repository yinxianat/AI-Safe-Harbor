ALTER TABLE "User" ADD COLUMN "statusVisibleTo" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "KnowMeEntry" ALTER COLUMN "category" SET DEFAULT 'about_me';
