-- CreateEnum
CREATE TYPE "WizardKind" AS ENUM ('add_birthday', 'inline_edit', 'settings_edit');

-- CreateTable
CREATE TABLE "wizard_sessions" (
    "user_id" TEXT NOT NULL,
    "kind" "WizardKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wizard_sessions_pkey" PRIMARY KEY ("user_id","kind")
);

-- CreateIndex
CREATE INDEX "wizard_sessions_updated_at_idx" ON "wizard_sessions"("updated_at");
