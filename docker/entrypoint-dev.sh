#!/bin/sh
set -e

echo "🚀 Starting Taskosaur Development Environment..."

# Function to wait for PostgreSQL
wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL to be ready..."

  # Extract database host from DATABASE_URL (format: postgresql://user:pass@host:port/db)
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

  max_attempts=30
  attempt=0

  until nc -z "$DB_HOST" "${DB_PORT:-5432}" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo "❌ PostgreSQL did not become ready in time"
      exit 1
    fi
    echo "   Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
    sleep 2
  done
  echo "✅ PostgreSQL is ready!"
}

# Function to wait for Redis
wait_for_redis() {
  echo "⏳ Waiting for Redis to be ready..."

  max_attempts=30
  attempt=0

  until nc -z "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo "❌ Redis did not become ready in time"
      exit 1
    fi
    echo "   Waiting for Redis... (attempt $attempt/$max_attempts)"
    sleep 2
  done
  echo "✅ Redis is ready!"
}

echo ""
echo "🔧 Bootstrapping Application..."

# Wait for dependencies
wait_for_postgres
wait_for_redis

# Generate Prisma Client
echo ""
echo "🔨 Generating Prisma Client..."
npm run db:generate

# Run database migrations
echo ""
echo "🗃️  Running database migrations..."
npm run db:migrate || {
  echo "⚠️  Migration failed or already up to date"
}

# Seed database (idempotent - safe to run multiple times)
echo ""
echo "🌱 Seeding database..."
npm run db:seed || {
  echo "⚠️  Seeding failed or data already exists"
}

# Seed admin user (idempotent)
echo ""
echo "👤 Seeding admin user..."
npm run db:seed:admin || {
  echo "⚠️  Admin seeding failed or already exists"
}

echo ""
echo "✅ Bootstrap completed!"
echo ""
echo "🎯 Starting development servers (frontend + backend)..."
exec npm run dev
