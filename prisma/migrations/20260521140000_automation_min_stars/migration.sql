-- AlterTable
ALTER TABLE "Reply" ADD COLUMN "sentByAutomation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "minStars" INTEGER NOT NULL DEFAULT 4;

-- CreateIndex
CREATE INDEX "Reply_sentByAutomation_idx" ON "Reply"("sentByAutomation");
