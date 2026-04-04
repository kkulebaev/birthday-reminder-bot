# birthday-reminder-bot

Telegram-first birthday reminder bot.

## Current status

Working beta foundation:
- TypeScript project setup
- grammY bot bootstrap
- Prisma schema and Postgres migration
- CRUD-style Telegram commands for birthday records
- Scheduler entrypoint for birthday notifications
- Delivery logging via `delivery_logs`

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
- `/cancel`
- `/ping`

## Stack

- TypeScript
- Node.js
- grammY
- Prisma
- Postgres

## Domain model

- `users`
- `user_settings`
- `birthdays`
- `delivery_logs`

## Environment variables

See `.env.example`.

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

## Scheduler notes

Current scheduler behavior:
- checks birthdays for today in `Europe/Moscow`
- sends notifications through the same Telegram bot
- writes delivery status into `delivery_logs`
- prevents duplicate successful sends for the same birthday and occurrence date

This is the first scheduler cut and can be refined further with explicit notify-at gating, retries, and periodic deployment wiring.
