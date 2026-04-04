-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "telegram_chat_id" TEXT NOT NULL,
    "telegram_username" TEXT,
    "telegram_first_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "notify_at" TEXT NOT NULL DEFAULT '09:00',
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "birthdays" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "birth_year" INTEGER,
    "notes" TEXT,
    "is_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthdays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "birthday_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "occurrence_date" DATE NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "telegram_message_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_user_id_key" ON "users"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_chat_id_key" ON "users"("telegram_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_logs_user_id_birthday_id_notification_type_occurrenc_key" ON "delivery_logs"("user_id", "birthday_id", "notification_type", "occurrence_date");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthdays" ADD CONSTRAINT "birthdays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_logs" ADD CONSTRAINT "delivery_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_logs" ADD CONSTRAINT "delivery_logs_birthday_id_fkey" FOREIGN KEY ("birthday_id") REFERENCES "birthdays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
