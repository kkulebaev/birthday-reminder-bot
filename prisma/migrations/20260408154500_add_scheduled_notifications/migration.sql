-- CreateEnum
CREATE TYPE "ScheduledNotificationStatus" AS ENUM ('pending', 'processing', 'sent', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "scheduled_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "birthday_id" TEXT NOT NULL,
    "occurrence_date" DATE NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "notify_at" TEXT NOT NULL,
    "status" "ScheduledNotificationStatus" NOT NULL DEFAULT 'pending',
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_notifications_birthday_id_occurrence_date_key" ON "scheduled_notifications"("birthday_id", "occurrence_date");

-- CreateIndex
CREATE INDEX "scheduled_notifications_status_scheduled_for_idx" ON "scheduled_notifications"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_notifications_birthday_id_status_idx" ON "scheduled_notifications"("birthday_id", "status");

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_birthday_id_fkey" FOREIGN KEY ("birthday_id") REFERENCES "birthdays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
