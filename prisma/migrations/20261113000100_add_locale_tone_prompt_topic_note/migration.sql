-- Add locale to User, free-text tone prompt to ConnectionPreference,
-- and optional note to TopicSetting for refined boundary context.
ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "ConnectionPreference" ADD COLUMN "tonePrompt" TEXT;
ALTER TABLE "TopicSetting" ADD COLUMN "note" TEXT;
