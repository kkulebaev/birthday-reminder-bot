# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager: **pnpm** (pinned via `packageManager` in `package.json`, `pnpm-lock.yaml` is committed). Enable with `corepack enable` if pnpm is not on `PATH`. Node 24+ is required (`engines.node` and the Docker base image both pin to Node 24).

- `pnpm dev` — run the webhook server with `tsx` (no build step)
- `pnpm build` — `tsc -p tsconfig.json` → `dist/`
- `pnpm start` — run the compiled `dist/server.js`
- `pnpm typecheck` — `tsc --noEmit` (strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`)
- `pnpm lint` — `eslint .`
- `pnpm test` — `vitest run` (single run, not watch)
- `pnpm test:coverage` — vitest with v8 coverage
- Run a single test file: `pnpm exec vitest run test/<file>.test.ts`
- Run by name pattern: `pnpm exec vitest run -t "<pattern>"`
- `pnpm prisma:generate` — regenerate Prisma client (required after editing `prisma/schema.prisma`)
- `pnpm prisma:migrate:dev` — create/apply a dev migration
- `pnpm prisma:migrate:deploy` — apply pending migrations (production)

Required env vars: `TELEGRAM_BOT_TOKEN`, `DATABASE_URL` (PostgreSQL), `DKRON_API_URL` (e.g. `http://dkron:8080`), `INTERNAL_WEBHOOK_SECRET` (shared secret used between dkron jobs and the bot's internal endpoint). Optional: `TELEGRAM_WEBHOOK_PATH` (default `/telegram/webhook`), `PORT` (default `3000`), and either `BOT_INTERNAL_URL` or `RAILWAY_PRIVATE_DOMAIN` to tell dkron how to reach the bot's `/internal/fire-reminder` endpoint (one of them must be set when `schedulerService` runs).

Tests live in `test/` (vitest `include` is `test/**/*.test.ts`).

## Architecture

This is a Telegram bot (grammY) that delivers birthday reminders. It runs as a single Express webhook server. Reminder timing is delegated to an external **dkron** instance via its HTTP API — the bot does not arm any in-process timers.

### Process model
`src/server.ts` is the single entry point. On startup it:
1. Calls `bot.init()` (grammY).
2. Calls `schedulerService.start()` — pings dkron and, if reachable, re-syncs every active birthday into a dkron job. If dkron is unreachable the bot still starts (jobs already living in dkron continue firing).
3. Starts Express, exposing:
   - `GET /healthz`
   - `POST <TELEGRAM_WEBHOOK_PATH>` — forwards updates to `bot.handleUpdate(req.body)`
   - `POST /internal/fire-reminder` — invoked by dkron jobs; gated by the `X-Internal-Auth` header which must equal `INTERNAL_WEBHOOK_SECRET`.

Telegram must be configured to send updates via webhook (no long-polling code path).

### Bot composition (`src/bot.ts`)
`bot.ts` is the top-level router: it registers all `/commands`, the unified `callback_query:data` handler, and a `message:text` handler that fans text out to the active session (inline edit → settings edit → add-birthday wizard) before falling through. Almost every command is gated by `isPrivateChat(ctx)` and starts with `upsertUserFromContext(ctx)` to ensure a `User` + `UserSettings` row exists. Feature modules expose pure helpers that return `{ text, replyMarkup? }`; `bot.ts` is responsible for actually calling `ctx.reply` / `ctx.answerCallbackQuery`.

Callback data is namespaced: `birthday:add:*`, `birthday:select:*`, `birthday:view:*`, `settings:*`, plus generic birthday actions handled by `handleBirthdayCallback` and main-menu actions by `handleMainMenuCallback`. When adding a new callback, route it from the central handler in `bot.ts` and keep the action logic in the feature module.

### Multi-step flows are in-memory
Three flows hold per-user state in module-level `Map`s keyed by Telegram user id:
- `add-birthday.ts` — wizard for `/add` and the menu add flow.
- `birthday-inline-edit.ts` — single-message edits (rename / setdate / note) triggered after picking a record.
- `settings.ts` — manual timezone or notify-time entry.

These sessions are **lost on restart**. Anything that needs to survive a restart must be persisted via Prisma. The `bot.command('cancel')` handler clears all three.

### Reminder scheduling (dkron)
The reminder loop is owned by an external dkron service. The bot only mirrors the desired job state into dkron and serves the callback when a job fires.

- `src/dkron-client.ts` is a thin wrapper around dkron's HTTP API (`POST /v1/jobs`, `DELETE /v1/jobs/:name`, `GET /v1/jobs` for ping). Each birthday becomes one dkron job named `bday-<birthdayId>` (see `getBirthdayJobName`).
- The cron expression is **6 fields** (`seconds minute hour day month *`) — dkron expects seconds, do not drop them. `buildBirthdayCronExpression` produces `0 MM HH DD MM *` and the job's `timezone` is set to the user's IANA zone, so dkron evaluates the local time directly.
- Each job is configured with the `http` executor: `POST <BOT_INTERNAL_URL or http://$RAILWAY_PRIVATE_DOMAIN:$PORT>/internal/fire-reminder`, `Content-Type: application/json`, `X-Internal-Auth: $INTERNAL_WEBHOOK_SECRET`, body `{"birthdayId":"..."}`, `expectCode: "200"`, `retries: 3`, `concurrency: "forbid"`.
- `src/scheduler-service.ts` owns the sync logic. Anything that affects whether a reminder should fire (toggle, rename, delete, date change, settings change) **must** call either `schedulerService.rebuildBirthdayNotification(birthdayId)` (single record) or `schedulerService.rebuildUserNotifications(userId)` (whole user, e.g. after timezone/notifyAt change). `rebuildBirthdayNotification` will upsert the job when `shouldHaveJob` is true, and delete it otherwise (record missing/soft-deleted, `isReminderEnabled=false`, or `notificationsEnabled=false`).
- When a job fires, dkron calls `POST /internal/fire-reminder` (handled in `server.ts`). The handler re-checks the latest birthday + user settings, sends the Telegram message via `bot.api.sendMessage`, and writes a row into `DeliveryLog` (idempotent on `(userId, birthdayId, notificationType, occurrenceDate)` — `occurrenceDate` is "today" in UTC). If the birthday is gone or reminders are off, it deletes the dkron job and returns 200. On send failure the row is recorded as `failed` and a 500 is returned so dkron can retry.
- There is no in-process timer, no `setTimeout`, no `ScheduledNotification` table. Idempotency and retries are dkron's responsibility (`retries: 3`, `concurrency: "forbid"`); same-day duplicates are absorbed by the `DeliveryLog` unique key.

### Time zones
Birthdays are stored as `(month, day, birthYear?)` integers, not as `Date`s. The dkron job carries the user's IANA timezone so that the cron expression is evaluated in their local time. When you need "today" in user-local terms or want to format an upcoming date, use the helpers in `notification-schedule.ts` (or the relevant feature module) — never build comparisons out of raw `Date` arithmetic.

### Database
PostgreSQL via Prisma (`prisma/schema.prisma`). `PrismaClient` is exported as a singleton from `src/db.ts`. Soft-delete pattern: `Birthday.deletedAt`. `DeliveryLog` is the audit trail for sends and is the only notification-related table (a `ScheduledNotification` queue table existed in an earlier revision and has been dropped — see `prisma/migrations/`).

### TypeScript / ESM specifics
- `"type": "module"` and `module: NodeNext` — relative imports inside `src/` **must** include the `.js` extension (e.g. `import { bot } from './bot.js'`) even though the source is `.ts`. Existing files all do this.
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on; treat array/Map lookups as `T | undefined`.

## Conventions

- Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `revert`). No body, no Claude/Anthropic co-author trailer. Description is short, imperative, lowercase, no trailing period.
- User-facing strings in the bot are in Russian — match the existing tone when adding new ones.
