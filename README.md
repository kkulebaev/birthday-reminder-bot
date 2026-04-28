<div align="center">

<img src="./assets/banner.svg" alt="Birthday Reminder Bot — Lumen" width="100%" />

<h1>🎂 Birthday Reminder Bot — Lumen</h1>

<p><i>A calm Telegram-first assistant for remembering important birthdays — and important dates.</i></p>

<p>
  <a href="https://github.com/kkulebaev/birthday-reminder-bot/actions/workflows/test.yml">
    <img alt="Tests"
         src="https://img.shields.io/github/actions/workflow/status/kkulebaev/birthday-reminder-bot/test.yml?branch=main&label=tests&style=flat-square&logo=vitest&logoColor=white&color=2DD4BF" />
  </a>
  <a href="https://github.com/kkulebaev/birthday-reminder-bot/actions/workflows/lint.yml">
    <img alt="Lint"
         src="https://img.shields.io/github/actions/workflow/status/kkulebaev/birthday-reminder-bot/lint.yml?branch=main&label=lint&style=flat-square&logo=eslint&logoColor=white&color=8B5CF6" />
  </a>
  <a href="https://github.com/kkulebaev/birthday-reminder-bot/actions/workflows/typecheck.yml">
    <img alt="Typecheck"
         src="https://img.shields.io/github/actions/workflow/status/kkulebaev/birthday-reminder-bot/typecheck.yml?branch=main&label=typecheck&style=flat-square&logo=typescript&logoColor=white&color=3178C6" />
  </a>
</p>

<p>
  <img alt="Node 24+"
       src="https://img.shields.io/badge/node-%E2%89%A524-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img alt="TypeScript"
       src="https://img.shields.io/badge/typescript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="pnpm"
       src="https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white" />
  <img alt="grammY"
       src="https://img.shields.io/badge/grammY-1.x-26A5E4?style=flat-square&logo=telegram&logoColor=white" />
  <img alt="Prisma"
       src="https://img.shields.io/badge/prisma-6.x-2D3748?style=flat-square&logo=prisma&logoColor=white" />
  <img alt="PostgreSQL"
       src="https://img.shields.io/badge/postgres-16-336791?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="Express"
       src="https://img.shields.io/badge/express-5-000000?style=flat-square&logo=express&logoColor=white" />
  <img alt="Dkron"
       src="https://img.shields.io/badge/dkron-scheduler-7C5CFF?style=flat-square&logo=apacheairflow&logoColor=white" />
  <img alt="Vitest"
       src="https://img.shields.io/badge/vitest-3-6E9F18?style=flat-square&logo=vitest&logoColor=white" />
</p>

</div>

---

## ✨ What it is

**Lumen** is a Telegram bot that does one thing well: it keeps the birthdays that matter to you and gently nudges you when the day comes — at *your* time, in *your* timezone.

- 📒 Save birthdays through a friendly step-by-step flow
- 🗓 Browse upcoming dates from a single screen, page by page
- 🎈 Open and edit each birthday card inline (rename, set date, add a note)
- 🔔 Receive a reminder on the day, with quick actions on the message itself
- 🌍 Per-user notification time and IANA timezone
- ♻️ Schedule survives restarts — jobs live in [dkron](https://dkron.io/), not in process memory

## 🏃 At a glance

```
You: /add
Lumen: Как зовут именинника?
You: Мама
Lumen: В каком месяце родилась? [Янв] [Фев] [Мар] …
You: Май
Lumen: Какого числа?
You: 17
Lumen: ✨ Сохранил. Напомню 17 мая в 09:00 (Europe/Moscow).
```

## 🧭 Main flows

### Add a birthday
Use `/add` or open `/menu` and follow the step-by-step flow. Every step has a back button so you can revisit earlier answers before saving.

### Check upcoming birthdays
`/upcoming` shows the nearest important dates, paginated. Open any card from there.

### Find a person quickly
`/search <name>` resolves a card by name. Ambiguous matches surface a picker.

### Manage reminder settings
`/menu` → **⚙️ Настройки** to update timezone, notification time, or to toggle reminders entirely.

## 🤖 Commands

| Command | What it does |
| --- | --- |
| `/start` | Greeting + onboarding defaults |
| `/menu` | The main hub for everyday use |
| `/help` | A short cheat sheet |
| `/add` | Start the add-birthday wizard |
| `/upcoming` | List the nearest birthdays |
| `/search <name>` | Find a card by name |
| `/view <name>` | Open a birthday card |
| `/note <name> \| <text>` | Replace the note on a card |
| `/rename <name> \| <new name>` | Rename a card |
| `/setdate <name> \| <DD.MM[.YYYY]>` | Change the date |
| `/toggle <name>` | Enable / disable the reminder for one person |
| `/delete <name>` | Soft-delete a card |
| `/cancel` | Drop the active wizard / inline edit |

User-facing text is in Russian; keep that tone if you contribute new strings.

## 🏗 Architecture

Lumen is **one** Express webhook server. It does not run an in-process scheduler — reminder timing is owned by an external **[dkron](https://dkron.io/)** instance, which fires HTTP callbacks back into the bot.

```
┌──────────────┐  webhook   ┌──────────────────────────────┐  HTTP   ┌────────────┐
│  Telegram    │ ─────────▶ │  birthday-reminder-bot       │ ─────▶  │   dkron    │
│              │            │  Express + grammY + Prisma   │ ◀─────  │  scheduler │
└──────────────┘            └──────────────────────────────┘  fire   └────────────┘
                                       │  reads / writes
                                       ▼
                               ┌──────────────┐
                               │ PostgreSQL   │
                               └──────────────┘
```

- **Birthday create / update / toggle / delete** → `schedulerService.rebuildBirthdayNotification()` → `POST /v1/jobs` to dkron (or `DELETE` if the reminder should be off).
- **A job fires** → dkron does `POST /internal/fire-reminder` with `{ "birthdayId": "…" }` → the bot resolves the latest state, sends the Telegram message, and writes a `DeliveryLog` row.
- One dkron job per active birthday, named `bday-<id>`. The cron expression is **6-field** (`seconds minute hour day month *`) and the job's `timezone` is set to the user's IANA zone, so dkron evaluates the local time directly.
- Same-day duplicates are absorbed by `DeliveryLog`'s unique key on `(userId, birthdayId, notificationType, occurrenceDate)`.

For deeper context, see [`CLAUDE.md`](./CLAUDE.md).

## 🚀 Getting started

### Requirements

- **Node.js 24+** (pinned in `package.json` and the Docker image)
- **pnpm 10** — enable via `corepack enable`
- **PostgreSQL** reachable via `DATABASE_URL`
- **dkron** reachable via `DKRON_API_URL`

### Install & run (local)

```bash
corepack enable
pnpm install
cp .env.example .env   # then fill in the required values
pnpm prisma:migrate:dev
pnpm dev               # tsx src/server.ts
```

The server listens on `PORT` (default `3000`) and exposes `GET /healthz`.

### Environment variables

| Var | Required | Notes |
| --- | :---: | --- |
| `TELEGRAM_BOT_TOKEN` | ✅ | From [@BotFather](https://t.me/BotFather). |
| `DATABASE_URL` | ✅ | PostgreSQL URL (`postgresql://…`). |
| `DKRON_API_URL` | ✅ | e.g. `http://dkron:8080`. |
| `INTERNAL_WEBHOOK_SECRET` | ✅ | Shared secret between dkron jobs and `/internal/fire-reminder` (`X-Internal-Auth`). |
| `BOT_INTERNAL_URL` *or* `RAILWAY_PRIVATE_DOMAIN` | ✅* | How dkron reaches the bot. One of them must be set on startup. |
| `TELEGRAM_WEBHOOK_PATH` | — | Defaults to `/telegram/webhook`. |
| `PORT` | — | Defaults to `3000`. |

### Telegram webhook

Lumen does not long-poll. Point Telegram at the public URL of `<host><TELEGRAM_WEBHOOK_PATH>`:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-host.example/telegram/webhook"
```

## 🧪 Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Run the server with `tsx` (no build) |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run the compiled `dist/server.js` |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | `eslint .` |
| `pnpm test` | `vitest run` |
| `pnpm test:coverage` | vitest + v8 coverage |
| `pnpm prisma:generate` | Regenerate the Prisma client |
| `pnpm prisma:migrate:dev` | Create / apply a dev migration |
| `pnpm prisma:migrate:deploy` | Apply pending migrations (production) |

Run a single test file:

```bash
pnpm exec vitest run test/<file>.test.ts
# or by name:
pnpm exec vitest run -t "<pattern>"
```

## 🐳 Docker

```bash
docker build -t birthday-reminder-bot .
docker run --rm \
  --env-file .env \
  -p 3000:3000 \
  birthday-reminder-bot
```

The container starts the webhook server only — bring your own Postgres and your own dkron. Run Prisma migrations before starting the container in production.

## 📁 Project layout

```
src/
├── server.ts              # Express entrypoint + /internal/fire-reminder
├── bot.ts                 # grammY router (commands, callbacks, text)
├── scheduler-service.ts   # syncs Birthdays into dkron jobs
├── dkron-client.ts        # thin wrapper over dkron's HTTP API
├── add-birthday.ts        # add wizard (in-memory state)
├── birthday-inline-edit.ts# rename / setdate / note (in-memory state)
├── settings.ts            # timezone & notify-time editor
└── …
prisma/
├── schema.prisma
└── migrations/
test/                      # vitest specs
```

## 📄 License

[MIT](./LICENSE) © Konstantin Kulebaev.

<sub>Made with quiet evenings, Telegram, and a friendly bot named Lumen.</sub>
