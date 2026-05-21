-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('APIFY', 'GOOGLE');

-- CreateEnum
CREATE TYPE "GoogleConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "status" "GoogleConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "googleAccountId" TEXT,
    "locationName" TEXT,
    "placeId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "ReviewSource" NOT NULL DEFAULT 'APIFY';

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnection_clienteId_key" ON "GoogleConnection"("clienteId");

-- CreateIndex
CREATE INDEX "GoogleConnection_status_idx" ON "GoogleConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_clienteId_externalId_key" ON "Review"("clienteId", "externalId");

-- CreateIndex
CREATE INDEX "Review_source_idx" ON "Review"("source");

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
