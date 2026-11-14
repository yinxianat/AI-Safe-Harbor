-- Account-wide reader-side emotional softening.
--
-- Supersedes ConnectionPreference.softenEmotions, which was per-connection
-- and applied to messages only. The new shield covers status, wall posts
-- and Know Me answers too, and is on by default so first-time users get
-- the protection without having to opt in.
--
-- The emotions column is a string[] of emotion keys the user wants softened.
-- Default to every known emotion so the shield is at full strength unless
-- the user narrows it. Keeping it as a Postgres array rather than a JSON
-- blob keeps `= ANY($emotions)` queries possible if we ever need them.
ALTER TABLE "User" ADD COLUMN "emotionalShield" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emotionalShieldEmotions" TEXT[] NOT NULL DEFAULT ARRAY[
  'anger',
  'frustration',
  'anxiety',
  'stress',
  'overwhelm',
  'burnout',
  'sadness',
  'despair',
  'fear',
  'shame',
  'guilt',
  'resentment',
  'loneliness',
  'exhaustion',
  'harshness'
];
