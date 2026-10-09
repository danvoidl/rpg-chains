-- CreateTable
CREATE TABLE "BattleJournal" (
    "battleId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "node" JSONB NOT NULL,
    "needsMaster" BOOLEAN NOT NULL,
    "masterId" TEXT NOT NULL,
    "participants" JSONB NOT NULL,
    "turnTimers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleJournal_pkey" PRIMARY KEY ("battleId")
);

-- CreateTable
CREATE TABLE "BattleJournalEntry" (
    "battleId" TEXT NOT NULL,
    "fromSeq" INTEGER NOT NULL,
    "events" JSONB NOT NULL,

    CONSTRAINT "BattleJournalEntry_pkey" PRIMARY KEY ("battleId","fromSeq")
);

-- CreateIndex
CREATE INDEX "BattleJournal_roomId_idx" ON "BattleJournal"("roomId");

-- AddForeignKey
ALTER TABLE "BattleJournal" ADD CONSTRAINT "BattleJournal_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleJournalEntry" ADD CONSTRAINT "BattleJournalEntry_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "BattleJournal"("battleId") ON DELETE CASCADE ON UPDATE CASCADE;
