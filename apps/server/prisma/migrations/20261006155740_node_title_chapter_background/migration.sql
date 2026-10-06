-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "backgroundHeight" INTEGER,
ADD COLUMN     "backgroundImageUrl" TEXT,
ADD COLUMN     "backgroundWidth" INTEGER;

-- AlterTable
ALTER TABLE "ChapterNode" ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';
