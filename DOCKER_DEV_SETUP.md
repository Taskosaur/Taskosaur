# Docker Development Setup

Quick guide to run Taskosaur in development mode using Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose V2

## Important Files

- **`Dockerfile.dev`** - Development container configuration
- **`docker-compose.dev.yml`** - Orchestrates all services (PostgreSQL, Redis, Application)
- **`docker/entrypoint-dev.sh`** - Entrypoint script that handles automatic bootstrapping
- **`.env.example`** - Environment variables template (copy to `.env` to customize)

## Quick Start

### 1. Start all services

```bash
docker-compose -f docker-compose.dev.yml up
```

Or run in detached mode:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**That's it!** The entrypoint script automatically handles:
- ✅ Waiting for PostgreSQL and Redis to be ready
- ✅ Generating Prisma Client
- ✅ Running database migrations
- ✅ Seeding the database (idempotent - safe on restarts)
- ✅ Starting the application

### 2. Access the application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Backend API Docs**: http://localhost:3000/api/docs

## Services

The docker-compose setup includes:

- **postgres** (PostgreSQL 16) - Internal only
- **redis** (Redis 7) - Internal only
- **app** (Backend + Frontend) - Ports 3000 (Backend) & 3001 (Frontend)

## Useful Commands

### View logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Application only
docker-compose -f docker-compose.dev.yml logs -f app
```

### Stop services

```bash
docker-compose -f docker-compose.dev.yml stop
```

### Stop and remove containers

```bash
docker-compose -f docker-compose.dev.yml down
```

### Stop and remove containers + volumes (clean slate)

```bash
docker-compose -f docker-compose.dev.yml down -v
```

### Restart the application

```bash
docker-compose -f docker-compose.dev.yml restart app
```

### Execute commands in containers

```bash
# Application shell
docker-compose -f docker-compose.dev.yml exec app sh

# Run Prisma Studio
docker-compose -f docker-compose.dev.yml exec app npm run db:studio

# Run backend tests
docker-compose -f docker-compose.dev.yml exec app npm run test:backend

# Run frontend tests
docker-compose -f docker-compose.dev.yml exec app npm run test:frontend
```

### Rebuild containers (after dependency changes)

```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Development Workflow

The setup uses volume mounts for hot-reloading:

- Code changes are automatically detected
- No need to rebuild containers for code changes
- Backend restarts automatically (NestJS watch mode)
- Frontend supports Fast Refresh (Next.js)

## Troubleshooting

### Port conflicts

If ports 3000 (backend), 3001 (frontend), 5432, or 6379 are already in use, you can modify them in `docker-compose.dev.yml`:

```yaml
ports:
  - "NEW_PORT:CONTAINER_PORT"
```

### Database connection issues

Ensure PostgreSQL is healthy:

```bash
docker-compose -f docker-compose.dev.yml ps postgres
```

### Reset database

```bash
docker-compose -f docker-compose.dev.yml exec backend npm run db:reset
```

### Clean start (remove all data)

```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up
```

## Environment Variables

The application uses environment variables for configuration. Default values are provided in `docker-compose.dev.yml`.

### Optional: Custom Configuration

To customize environment variables:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` with your custom values (JWT secrets, encryption keys, SMTP settings, etc.)
3. Docker Compose will automatically load the `.env` file if it exists
4. Restart containers to apply changes:
   ```bash
   docker-compose -f docker-compose.dev.yml restart
   ```

**Note:** Docker Compose automatically overrides `DATABASE_URL` and `REDIS_HOST` to use Docker service names (`postgres`, `redis`), so the `.env` file works for both local and Docker development.

## Automatic Bootstrapping

The Docker entrypoint script (`docker/entrypoint-dev.sh`) automatically performs the following on container startup:

1. **Wait for Dependencies**: Ensures PostgreSQL and Redis are ready
2. **Generate Prisma Client**: Runs `npm run db:generate`
3. **Database Migrations**: Runs `npm run db:migrate`
4. **Seed Database**: Runs `npm run db:seed` (idempotent)
5. **Seed Admin**: Runs `npm run db:seed:admin` (idempotent)
6. **Start Application**: Launches the development server

All seed operations are idempotent, so restarting containers won't create duplicate data.

## Manual Database Operations

If you need to run database commands manually:

```bash
# Run migrations
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

# Seed database
docker-compose -f docker-compose.dev.yml exec app npm run db:seed

# Reset database (clear and re-seed)
docker-compose -f docker-compose.dev.yml exec app npm run db:reset

# Access Prisma Studio
docker-compose -f docker-compose.dev.yml exec app npm run db:studio
```

## Notes

- The setup uses a single container running both frontend and backend via `npm run dev`
- Node modules are mounted as anonymous volumes to prevent host/container conflicts
- Hot-reloading works out of the box for both frontend and backend
- Redis and PostgreSQL data persist across container restarts
- Database bootstrapping happens automatically on every container start (idempotent)
- Both frontend and backend run concurrently in the same container
