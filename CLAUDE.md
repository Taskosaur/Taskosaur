# CLAUDE.md — Taskosaur

Taskosaur is an open-source project management platform with conversational AI task execution. It's a TypeScript monorepo: a NestJS REST/WebSocket backend and a Next.js frontend, backed by PostgreSQL (via Prisma ORM) and Redis (via BullMQ queues).

## Architecture

```
taskosaur/
├── backend/          # NestJS API server — port 3000
│   ├── src/
│   │   ├── modules/  # Feature modules (see list below)
│   │   ├── common/   # Shared interceptors, guards, decorators
│   │   ├── config/   # App configuration
│   │   ├── gateway/  # WebSocket (Socket.io) gateway
│   │   ├── seeder/   # Database seeding
│   │   └── prisma/   # PrismaService wrapper
│   └── prisma/       # schema.prisma + migrations
├── frontend/         # Next.js 15 app — port 3001
│   └── src/
│       ├── components/   # React components (tasks, projects, chat, kanban, gantt…)
│       ├── contexts/     # React contexts (auth, org, workspace, project, task…)
│       ├── hooks/        # Custom hooks
│       ├── utils/        # API client, data helpers
│       ├── types/        # TypeScript types
│       └── styles/       # CSS modules
├── docker/           # Docker entrypoints
├── scripts/          # Build & utility scripts
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── .env              # Local environment (gitignored)
└── .env.example      # Template — copy to .env to get started
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11 |
| Frontend framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Queue / jobs | Redis 7 + BullMQ |
| Real-time | Socket.io (WebSocket gateway) |
| Auth | JWT (access + refresh tokens) |
| UI components | Radix UI + Tailwind CSS |
| Rich text editor | Tiptap |
| Drag & drop | dnd-kit |
| Testing (backend) | Jest |
| Testing (frontend) | Vitest + Playwright |
| Containerisation | Docker Compose |

## Quick Start (Docker — recommended)

```bash
# 1. Copy env template (defaults work for local dev — no edits needed)
cp .env.example .env

# 2. Start everything
docker compose -f docker-compose.dev.yml up
```

Docker Compose automatically starts PostgreSQL and Redis, installs dependencies, generates the Prisma client, runs migrations, seeds the database, and starts both servers. First run takes a couple of minutes.

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Swagger docs:** http://localhost:3000/api/docs

### Useful Docker commands

```bash
# Follow logs
docker compose -f docker-compose.dev.yml logs -f

# Shell into the app container
docker compose -f docker-compose.dev.yml exec app sh

# Rebuild after Dockerfile changes
docker compose -f docker-compose.dev.yml up --build

# Stop and remove containers
docker compose -f docker-compose.dev.yml down
```

## Manual Setup (Node.js + local Postgres + Redis)

Requires Node.js 22+, npm 10+, PostgreSQL 16+, Redis 7+.

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL, REDIS_HOST, etc.
npm run db:migrate
npm run db:seed
npm run dev            # starts frontend + backend concurrently
```

## Development Commands

All commands run from the repo root.

### Servers

```bash
npm run dev              # Start frontend + backend (hot reload)
npm run dev:frontend     # Frontend only (port 3001)
npm run dev:backend      # Backend only (port 3000)
```

### Database

```bash
npm run db:migrate       # Apply pending Prisma migrations
npm run db:seed          # Seed with full sample data (idempotent)
npm run db:seed:admin    # Seed admin user only
npm run db:reset         # ⚠️  Wipe and re-migrate database
npm run db:studio        # Open Prisma Studio GUI
npm run db:generate      # Regenerate Prisma client after schema changes
```

### Testing

```bash
npm run test             # All tests
npm run test:backend     # Backend unit tests (Jest)
npm run test:frontend    # Frontend tests (Vitest)
npm run test:e2e         # Backend end-to-end tests
npm run test:cov         # Backend tests with coverage report
npm run test:watch       # Backend tests in watch mode
```

### Code Quality

```bash
npm run lint             # Lint all workspaces
npm run lint:backend
npm run lint:frontend
npm run format           # Prettier format (backend)
```

### Build

```bash
npm run build            # Build all workspaces
npm run build:dist       # Full distribution package
```

### Cleanup

```bash
npm run clean            # Remove all build artefacts + node_modules
```

## Backend Module Map

The backend is organised into NestJS feature modules under `backend/src/modules/`:

| Module | Responsibility |
|---|---|
| `auth` | JWT login, refresh, password reset |
| `users` | User profiles |
| `organizations` | Multi-tenant organisations |
| `workspaces` | Workspaces within an org |
| `projects` | Projects within a workspace |
| `tasks` | Core task CRUD |
| `task-statuses` | Custom status workflows |
| `task-comments` | Comments + @mentions |
| `task-dependencies` | Blocking/blocked-by relationships |
| `task-watchers` | Task subscriptions |
| `task-attachments` | File uploads on tasks |
| `task-label` | Task ↔ label mapping |
| `task-ranks` | Drag-and-drop ordering |
| `sprints` | Agile sprint management |
| `labels` | Org/project labels |
| `workflows` | Custom status workflows |
| `automation` | Automation rules engine |
| `ai-chat` | Conversational AI + browser automation |
| `search` | Global full-text search |
| `notifications` | In-app notifications |
| `inbox` | User inbox |
| `activity-log` | Audit trail |
| `time-entries` | Time tracking |
| `queue` | BullMQ job processing |
| `scheduler` | Cron/scheduled jobs |
| `email` | SMTP email notifications |
| `settings` | Org-level settings (incl. AI config) |
| `storage` | File storage (local or S3) |
| `admin` | Admin panel routes |
| `health` | Health check endpoint |

## AI Chat / Conversational Task Execution

The AI feature lives in `backend/src/modules/ai-chat/`. It supports OpenAI, Anthropic, OpenRouter, and Ollama (or any OpenAI-compatible endpoint).

To enable it:
1. Go to **Settings → Organization Settings → AI Assistant Settings** in the UI
2. Toggle **Enable AI Chat** on
3. Enter an API key and the provider base URL

Provider base URLs:
- Anthropic: `https://api.anthropic.com/v1`
- OpenAI: `https://api.openai.com/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- Local (Ollama etc.): `http://localhost:11434/v1`

The AI executes tasks via in-app browser automation — it receives the current page URL and interactive element list, then emits `click`, `type`, `scroll`, and `select` actions in real time.

## Database Schema Highlights

Defined in `backend/prisma/schema.prisma`. Key models:

- `User` — authentication, profile, preferences
- `Organization` — top-level tenant
- `Workspace` — groups projects within an org
- `Project` — has members, workflows, labels, sprints
- `Task` — rich model: type (Task/Bug/Epic/Story/Subtask), priority, status, assignee, parent, custom fields, attachments, watchers, time entries
- `Sprint` — belongs to a project, contains tasks
- `TaskStatus` / `Workflow` / `StatusTransition` — configurable workflow engine
- `AutomationRule` / `RuleExecution` — automation engine
- `ActivityLog` — immutable audit trail

After editing `schema.prisma`, always run:
```bash
npm run db:generate   # regenerate Prisma client
npm run db:migrate    # create + apply a new migration
```

## Environment Variables

Key variables in `.env` (see `.env.example` for the full list):

```env
DATABASE_URL="postgresql://taskosaur:taskosaur@localhost:5432/taskosaur"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
ENCRYPTION_KEY="..."           # 64-char hex — encrypts stored API keys
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
FRONTEND_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3001
```

In Docker Compose, `DATABASE_URL` and `REDIS_HOST` are automatically overridden to use service names (`postgres`, `redis`).

## Coding Conventions

- **TypeScript strict mode** throughout — no `any` unless unavoidable
- **Backend**: constructor-based dependency injection; DTOs for all request/response shapes; try/catch error handling; follow existing module layout
- **Frontend**: functional components + hooks; TypeScript interfaces for all props; follow existing component/context structure
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Pre-commit hook** (Husky): linting runs automatically. Bypass only in emergencies with `--no-verify`

## Agent Workflow

After making changes:

1. `npm run lint` — fix any lint errors before committing
2. `npm run test:backend` / `npm run test:frontend` — run tests for the area changed
3. `npm run db:migrate` — if `schema.prisma` was modified
4. `npm run build` — verify the build still passes

## Troubleshooting

**Database connection errors** — check `DATABASE_URL` in `.env` and that PostgreSQL is running. Re-run `npm run db:migrate`.

**Redis connection errors** — check `REDIS_HOST` / `REDIS_PORT`. The app degrades gracefully if Redis is unavailable (queue falls back).

**Port conflicts** — backend is 3000, frontend is 3001. Change the port mappings in `docker-compose.dev.yml` if something else is already using those ports.

**Dependency issues** — delete `node_modules` at root, `frontend/node_modules`, and `backend/node_modules`, then re-run `npm install`.

**Prisma client out of date** — run `npm run db:generate` after any schema change.

## Useful Links

- Swagger / API docs: http://localhost:3000/api/docs (when running)
- Prisma Studio: run `npm run db:studio`
- GitHub: https://github.com/Taskosaur/Taskosaur
- Discord: https://discord.gg/5cpHUSxePp
