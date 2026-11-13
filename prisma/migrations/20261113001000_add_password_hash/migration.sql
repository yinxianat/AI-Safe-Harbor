-- Password-based login as an alternative to magic links. Nullable so existing
-- magic-link users keep working without migration-time password assignment.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
