# birthday-reminder-bot

Telegram-first birthday reminder bot.

## Current status

Bootstrap is ready:
- TypeScript project setup
- grammY bot bootstrap
- Prisma schema for the first domain model
- Initial Postgres migration applied successfully
- `/start` creates or updates a user and initializes default settings
- `/help`, `/add`, and `/cancel` are wired
- `/add` now saves birthdays to Postgres through Prisma

## V1 scope

- Multi-user early beta
- Telegram bot for managing birthdays
- Birthdays stored in Postgres
- Daily birthday notifications sent by the same bot
- Scheduler-driven delivery with idempotent delivery logs

## Stack

- TypeScript
- Node.js
- grammY
- Prisma
- Postgres

## Planned domain model

- `users`
- `user_settings`
- `birthdays`
- `delivery_logs`

## Environment variables

See `.env.example`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run prisma:generate`
- `npm run prisma:migrate:dev`
- `npm run prisma:migrate:deploy`
