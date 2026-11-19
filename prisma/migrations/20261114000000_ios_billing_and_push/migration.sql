-- Billing and push columns on User, plus AppleReceiptEvent and Report tables
-- for Apple App Store integration and the moderation flow required by
-- App Store Review Guideline 1.1.6.

ALTER TABLE "User"
  ADD COLUMN "plan"                        TEXT        NOT NULL DEFAULT 'free',
  ADD COLUMN "appleOriginalTxId"           TEXT,
  ADD COLUMN "subscriptionExpiresAt"       TIMESTAMP(3),
  ADD COLUMN "tunesUsedToday"              INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN "tunesUsedTodayResetAt"       TIMESTAMP(3) NOT NULL DEFAULT now(),
  ADD COLUMN "apnsDeviceToken"             TEXT,
  ADD COLUMN "apnsDeviceTokenUpdatedAt"    TIMESTAMP(3);

CREATE INDEX "User_appleOriginalTxId_idx" ON "User"("appleOriginalTxId");

CREATE TABLE "AppleReceiptEvent" (
  "id"               TEXT PRIMARY KEY,
  "notificationUUID" TEXT NOT NULL UNIQUE,
  "notificationType" TEXT NOT NULL,
  "subtype"          TEXT,
  "originalTxId"     TEXT NOT NULL,
  "appUserId"        TEXT,
  "rawPayload"       JSONB NOT NULL,
  "processedAt"      TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX "AppleReceiptEvent_originalTxId_idx" ON "AppleReceiptEvent"("originalTxId");

CREATE TABLE "Report" (
  "id"         TEXT PRIMARY KEY,
  "reporterId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId"   TEXT NOT NULL,
  "reason"     TEXT,
  "status"     TEXT NOT NULL DEFAULT 'open',
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Report_status_createdAt_idx"        ON "Report"("status", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx"     ON "Report"("targetType", "targetId");
