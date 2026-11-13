-- Personal label a user sets for a contact, independent of the other
-- person's display name.
ALTER TABLE "ConnectionPreference" ADD COLUMN "nickname" TEXT;
