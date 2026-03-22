## Overview

Taskosaur is an open-source project management platform with conversational AI for task execution. It uses a monorepo structure with a NestJS backend and Next.js frontend.

## Development Commands

All commands are run from the repo root unless noted.

### Running the app
```bash
npm run dev              # Start both frontend and backend concurrently
npm run dev:backend      # Backend only (port 3000)
npm run dev:frontend     # Frontend only (port 3001)
```

### Building
```bash
npm run build            # Build all workspaces
npm run build:dist       # Build complete distribution package
```

### Testing
```bash
npm run test:backend     # Backend unit tests (Jest)
npm run test:e2e         # Backend end-to-end tests
npm run test:frontend    # Frontend E2E tests (Playwright)
npm run test:watch       # Backend tests in watch mode
npm run test:cov         # Backend tests with coverage
```

To run a single backend test file:
```bash
cd backend && npx jest path/to/test.spec.ts
```

### Linting & Formatting
```bash
npm run lint             # Lint all workspaces
npm run format           # Format backend with Prettier
npm run format:check     # Check formatting without writing
```

### Database
```bash
npm run db:migrate       # Run migrations (development)
npm run db:seed          # Seed with sample data (idempotent)
npm run db:seed:admin    # Seed admin user only
npm run db:reset         # Reset database (destroys all data)
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:studio        # Open Prisma Studio GUI
```

## Architecture

### Multi-tenancy Hierarchy
**Organization → Workspace → Project → Task** — data scoping follows this hierarchy throughout. Queries should always scope by organization/workspace to maintain tenant isolation.

### Backend (NestJS — `backend/`)

Feature-based module structure. Each module typically contains a controller, service, DTOs, and an entity/model file.

Key infrastructure:
- `prisma/` — Prisma schema and migrations; `PrismaService` is the singleton DB access layer
- `src/auth/` — JWT + Passport authentication; `JwtAuthGuard` is applied globally
- `src/gateway/` — WebSocket gateway for real-time updates (Socket.io)
- `src/queue/` — Bull/BullMQ job queues for async processing (emails, notifications, exports)
- `src/scheduler/` — Cron jobs and scheduled tasks
- `src/interceptors/` — Activity notification and request context tracking (cross-cutting)
- `src/ai-chat/` — Conversational AI module; supports OpenAI, Anthropic, OpenRouter, local providers

DTOs use `class-validator` decorators for request validation. All business logic lives in services, not controllers.

### Frontend (Next.js — `frontend/`)

Uses the App Router. State is managed via React Context (no Redux/Zustand).

Key structure:
- `src/app/` — App Router pages organized by feature
- `src/components/` — Feature-organized components; `src/components/ui/` for base primitives (Radix UI + Tailwind CSS v4)
- `src/contexts/` — React Contexts: `auth-context`, `workspace-context`, `organization-context`, `project-context`, `task-context`, etc.
- `src/utils/` — API client (Axios), data formatters, Gantt utilities
- `src/lib/browser-automation/` — In-app automation library used by the AI chat feature

The frontend is configured for static export (`output: 'export'` in `next.config.ts`), so no server-side rendering features like `getServerSideProps` are available.

### Real-time & Background Processing

- **WebSockets**: Socket.io via the Gateway module pushes live updates to clients
- **Job Queues**: Bull/BullMQ backed by Redis handles emails, notifications, and long-running exports asynchronously
- **Activity Logs**: An interceptor automatically records entity changes; do not manually write audit log entries unless absolutely necessary

### Environment Configuration

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection for queues
- `JWT_SECRET` and `ENCRYPTION_KEY` — Auth secrets
- `SMTP_*` — Email settings
- `NEXT_PUBLIC_API_URL` — Frontend API base URL (default `http://localhost:3000`)

### Docker

```bash
# Development stack (PostgreSQL 16 + Redis 7 + app)
docker compose -f docker-compose.dev.yml up

# Production
docker compose -f docker-compose.prod.yml up
```

Pre-built images available; `Dockerfile.dev` and `Dockerfile.prod` for custom builds.

### Husky Pre-commit Hooks

Husky runs lint and format checks before every commit. Fixes must pass before the commit is accepted — do not bypass with `--no-verify`.

# Project Overview