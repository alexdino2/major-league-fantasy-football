-- CreateTable
CREATE TABLE "MediaItem" (
    "id" SERIAL NOT NULL,
    "videoId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'highlight',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_videoId_key" ON "MediaItem"("videoId");

-- CreateIndex
CREATE INDEX "MediaItem_year_week_idx" ON "MediaItem"("year", "week");
