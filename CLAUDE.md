# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager: **npm** (package-lock.json is committed). Node 24+ is required (`.nvmrc`, `engines.node` and Docker base image all pin to Node 24).

- `npm run dev` — run the webhook server with `tsx` (no build step)
- `npm run build` — `tsc -p tsconfig.json` → `dist/`
- `npm run start` — run the compiled `dist/server.js`
- `npm run typecheck` — `tsc --noEmit` (strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`)
- `npm run lint` — `eslint .`
- `npm run test` — `vitest run` (single run, not watch)
- `npm run test:coverage` — vitest with v8 coverage
- Run a single test file: `npx vitest run test/<file>.test.ts`
- Run by name pattern: `npx vitest run -t "<pattern>"`
- `npm run prisma:generate` — regenerate Prisma client (required after editing `prisma/schema.prisma`)
- `npm run prisma:migrate:dev` — create/apply a dev migration
- `npm run prisma:migrate:deploy` — apply pending migrations (production)

Required env vars: `TELEGRAM_BOT_TOKEN`, `DATABASE_URL` (PostgreSQL). Optional: `TELEGRAM_WEBHOOK_PATH` (default `/telegram/webhook`), `PORT` (default `3000`). See `.env.example`.

Tests live in `test/` (vitest `include` is `test/**/*.test.ts`). One stray test file exists at `src/add-birthday.test.ts` — vitest does **not** pick it up; the active version is `test/add-birthday.test.ts`.

## Architecture

This is a Telegram bot (grammY) that delivers birthday reminders. It runs as a single Express webhook server that hosts both the bot update handler and an in-process scheduler.

### Process model
`src/server.ts` is the single entry point. On startup it:
1. Calls `bot.init()` (grammY).
2. Calls `schedulerService.start()` — recovers stale `processing` rows, then immediately processes any due notifications.
3. Starts Express, exposing `GET /healthz` and `POST <TELEGRAM_WEBHOOK_PATH>` which forwards updates to `bot.handleUpdate(req.body)`.

There is **no separate cron/poller process**. The reminder loop is entirely in-process — see "Scheduler" below. Telegram must be configured to send updates via webhook (no long-polling code path).

### Bot composition (`src/bot.ts`)
`bot.ts` is the top-level router: it registers all `/commands`, the unified `callback_query:data` handler, and a `message:text` handler that fans text out to the active session (inline edit → settings edit → add-birthday wizard) before falling through. Almost every command is gated by `isPrivateChat(ctx)` and starts with `upsertUserFromContext(ctx)` to ensure a `User` + `UserSettings` row exists. Feature modules expose pure helpers that return `{ text, replyMarkup? }`; `bot.ts` is responsible for actually calling `ctx.reply` / `ctx.answerCallbackQuery`.

Callback data is namespaced: `birthday:add:*`, `birthday:select:*`, `birthday:view:*`, `settings:*`, plus generic birthday actions handled by `handleBirthdayCallback` and main-menu actions by `handleMainMenuCallback`. When adding a new callback, route it from the central handler in `bot.ts` and keep the action logic in the feature module.

### Multi-step flows are in-memory
Three flows hold per-user state in module-level `Map`s keyed by Telegram user id:
- `add-birthday.ts` — wizard for `/add` and the menu add flow.
- `birthday-inline-edit.ts` — single-message edits (rename / setdate / note) triggered after picking a record.
- `settings.ts` — manual timezone or notify-time entry.

These sessions are **lost on restart**. Anything that needs to survive a restart must be persisted via Prisma. The `bot.command('cancel')` handler clears all three.

### Notification scheduler (`src/scheduler-service.ts`)
The scheduler is the trickiest part of the system. Read it before changing anything in this area.

- Source of truth is the `ScheduledNotification` table (Prisma). Each row represents one upcoming reminder for a (`birthdayId`, `occurrenceDate`) pair, with statuses `pending` → `processing` → `sent` / `failed` / `canceled`.
- A single in-memory `setTimeout` is armed for the **earliest** pending row. When it fires, `processDueNotifications()` claims and sends every row whose `scheduledFor <= now`, then re-arms the timer. `refreshTimer()` must be called any time scheduled rows change (after creating/canceling/rebuilding).
- `setTimeout` delays are capped at `MAX_TIMEOUT_MS` (`2^31 - 1` ≈ 24.8 days) — Node clamps anything larger to 1ms. When the capped timer fires it re-runs `refreshTimer()` and re-arms with the remaining delay. Do not remove this cap.
- Sending uses up to three immediate retries (`IMMEDIATE_RETRY_DELAYS_MS`). On total failure the row is rescheduled inside the same occurrence day (`FAILED_RECOVERY_DELAY_MS`, ~1h) until `MAX_TOTAL_ATTEMPTS` is reached or the day ends — only then is it marked `failed` and the next occurrence created.
- Stale `processing` rows older than `PROCESSING_TIMEOUT_MS` (10 min) are recovered to `pending` on startup, in case the previous process died mid-send.
- After a successful send, the next occurrence is scheduled via `createNextScheduledNotification`.
- Anything that affects when/whether a reminder fires (toggle, rename, delete, date change, settings change) **must** call `schedulerService.rebuildBirthdayNotification(birthdayId)` or `rebuildUserNotifications(userId)` so the in-memory timer and DB rows stay consistent.

### Time zones
All "next occurrence" math goes through `notification-schedule.ts`, which uses cached `Intl.DateTimeFormat` instances per IANA zone. Birthdays are stored as `(month, day, birthYear?)` integers, not as `Date`s — never compare them with raw `Date` arithmetic; always go through these helpers.

### Database
PostgreSQL via Prisma (`prisma/schema.prisma`). `PrismaClient` is exported as a singleton from `src/db.ts`. Soft-delete pattern: `Birthday.deletedAt`. `DeliveryLog` is the audit trail for sends; `ScheduledNotification` is the live queue.

### TypeScript / ESM specifics
- `"type": "module"` and `module: NodeNext` — relative imports inside `src/` **must** include the `.js` extension (e.g. `import { bot } from './bot.js'`) even though the source is `.ts`. Existing files all do this.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on; treat array/Map lookups as `T | undefined`.

## Conventions

- Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `revert`). No body, no Claude/Anthropic co-author trailer. Description is short, imperative, lowercase, no trailing period.
- User-facing strings in the bot are in Russian — match the existing tone when adding new ones.
