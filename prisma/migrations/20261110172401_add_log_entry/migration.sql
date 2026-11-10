-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "fingerprint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogEntry_lastSeenAt_idx" ON "LogEntry"("lastSeenAt");

-- CreateIndex
CREATE INDEX "LogEntry_level_lastSeenAt_idx" ON "LogEntry"("level", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "LogEntry_fingerprint_key" ON "LogEntry"("fingerprint");
