-- DropForeignKey
ALTER TABLE "GroupBag" DROP CONSTRAINT "GroupBag_roomId_fkey";

-- AlterTable
ALTER TABLE "CampaignProfile" ADD COLUMN     "gold" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Villain" ADD COLUMN     "drops" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "goldReward" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xpReward" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "GroupBag";

