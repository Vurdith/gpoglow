-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteContent" (
    "key" TEXT NOT NULL,
    "siteConfig" JSONB NOT NULL,
    "accessoryRecords" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
);
