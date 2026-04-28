-- DropForeignKey
ALTER TABLE "scheduled_notifications" DROP CONSTRAINT "scheduled_notifications_birthday_id_fkey";

-- DropForeignKey
ALTER TABLE "scheduled_notifications" DROP CONSTRAINT "scheduled_notifications_user_id_fkey";

-- DropTable
DROP TABLE "scheduled_notifications";

-- DropEnum
DROP TYPE "ScheduledNotificationStatus";
