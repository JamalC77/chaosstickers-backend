-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN     "hasRemovedBackground" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noBackgroundUrl" TEXT;
