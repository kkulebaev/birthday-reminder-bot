# birthday-reminder-bot

Telegram-first birthday reminder bot.

## Current status

Bootstrap is ready:
- TypeScript project setup
- grammY bot bootstrap
- Prisma schema for the first domain model
- SQL migration skeleton for initial Postgres schema
- `/start` creates or updates a user and initializes default settings
- `/help`, `/add`, and `/cancel` are wired
- `/add` currently uses a minimal in-memory wizard placeholder

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

## Notes about migrations

A hand-written initial migration skeleton is committed under `prisma/migrations`.
To apply it for real, provide a working `DATABASE_URL` and run Prisma migration commands against a live Postgres instance.
