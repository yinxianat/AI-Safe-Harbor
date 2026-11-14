-- Per-connection toggle: whether the AI should pull heated wording down a
-- notch before the receiver reads it. Default off so the behaviour the
-- receiver already set up does not change silently on existing connections.
ALTER TABLE "ConnectionPreference" ADD COLUMN "softenEmotions" BOOLEAN NOT NULL DEFAULT false;
