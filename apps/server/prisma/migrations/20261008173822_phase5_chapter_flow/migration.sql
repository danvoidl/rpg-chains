-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "progressSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RoomNodeClear" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "profileIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomNodeClear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomChapterState" (
    "roomId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "campfireNodeId" TEXT,
    "campfireSeq" INTEGER,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "RoomChapterState_pkey" PRIMARY KEY ("roomId","chapterId")
);

-- CreateIndex
CREATE INDEX "RoomNodeClear_roomId_idx" ON "RoomNodeClear"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomNodeClear_roomId_nodeId_key" ON "RoomNodeClear"("roomId", "nodeId");

-- AddForeignKey
ALTER TABLE "RoomNodeClear" ADD CONSTRAINT "RoomNodeClear_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChapterState" ADD CONSTRAINT "RoomChapterState_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
