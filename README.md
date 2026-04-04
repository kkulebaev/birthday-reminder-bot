# birthday-reminder-bot

Telegram-first birthday reminder bot.

## Current status

Working beta foundation:
- TypeScript project setup
- grammY bot bootstrap
- Prisma schema and Postgres migration
- CRUD-style Telegram commands for birthday records
- Webhook-based Telegram delivery
- Scheduler entrypoint for birthday notifications
- Delivery logging via `delivery_logs`
- Test notification command

## Available bot commands

- `/start`
- `/help`
- `/add`
- `/list`
- `/search <name>`
- `/view <name>`
- `/note <name> | <text>`
- `/toggle <name>`
- `/rename <name> | <new name>`
- `/setdate <name> | <DD.MM or DD.MM.YYYY>`
- `/delete <name>`
- `/test_notification`
- `/cancel`
- `/ping`

## Stack

- TypeScript
- Node.js
- grammY
- Express
- Prisma
- Postgres

## Domain model

- `users`
- `user_settings`
- `birthdays`
- `delivery_logs`

## Environment variables

See `.env.example`.

Webhook-related variables:
- `TELEGRAM_WEBHOOK_PATH` — optional, defaults to `/telegram/webhook`
- `PORT` — server port, provided by the platform

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run scheduler`
- `npm run typecheck`
- `npm run lint`
- `npm run prisma:generate`
- `npm run prisma:migrate:dev`
- `npm run prisma:migrate:deploy`

## CI

GitHub Actions runs separate workflows on push and pull request:
- `lint` → `npm run prisma:generate` + `npm run lint`
- `typecheck` → `npm run prisma:generate` + `npm run typecheck`
- `test` → `npm run prisma:generate` + `npm run test`

## Webhook notes

The bot now runs in webhook mode:
- app exposes a POST endpoint for Telegram updates
- webhook endpoint is served by the app, but Telegram webhook registration is done manually
- scheduler remains a separate process/command

## Scheduler notes

Current scheduler behavior:
- checks birthdays for today in each user's configured timezone
- respects `notify_at` as a "not earlier than" threshold
- sends notifications through the same Telegram bot
- writes delivery status into `delivery_logs`
- prevents duplicate successful sends for the same birthday and occurrence date
