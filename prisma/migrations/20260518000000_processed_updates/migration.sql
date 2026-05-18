-- CreateTable
CREATE TABLE "processed_updates" (
    "update_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_updates_pkey" PRIMARY KEY ("update_id")
);

-- CreateIndex
CREATE INDEX "processed_updates_created_at_idx" ON "processed_updates"("created_at");
