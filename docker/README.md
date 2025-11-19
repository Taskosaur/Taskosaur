# Taskosaur - Open Source Project Management with Conversational AI Task Execution

![Logo](https://raw.githubusercontent.com/Taskosaur/Taskosaur/main/frontend/public/taskosaur-logo.png)

[![Docker Pulls](https://img.shields.io/docker/pulls/taskosaur/taskosaur)](https://hub.docker.com/r/taskosaur/taskosaur)
[![Docker Image Size](https://img.shields.io/docker/image-size/taskosaur/taskosaur/latest)](https://hub.docker.com/r/taskosaur/taskosaur)
[![License](https://img.shields.io/badge/license-BSL-blue.svg)](https://github.com/Taskosaur/Taskosaur/blob/main/LICENSE.md)

**Official Docker image for Taskosaur** - An open source project management platform with conversational AI for task execution in-app that lets you manage projects through natural conversation directly within the application.

## Quick Start

```bash
# Create docker-compose.yml (see below)
docker compose up -d

# Access at http://localhost:3000
```

## What is Taskosaur?

Taskosaur is a self-hosted project management platform that combines traditional PM features with conversational AI for task execution in-app. The AI assistant performs actions directly in your browser through natural conversation. Instead of clicking through forms and menus, simply describe what you need in natural language.

**Key Features:**
- 🤖 Conversational AI for task execution in-app
- 💬 Natural language project management through in-app chat
- 🏠 Self-hosted - your data stays with you
- 💰 Bring your own LLM API key
- 📊 Full PM suite: Kanban, sprints, dependencies, time tracking
- 🌐 Open Source (Business Source License)

## Supported Architectures

Multi-architecture images supporting:
- `linux/amd64` - x86-64 (Intel/AMD)
- `linux/arm64` - ARM 64-bit (Apple Silicon, AWS Graviton)

Docker automatically pulls the correct architecture for your platform.

## Docker Compose Setup (Recommended)

Create a `docker-compose.yml` file:

```yaml
services:
  # PostgreSQL Database
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: taskosaur
      POSTGRES_PASSWORD: taskosaur_password_change_this
      POSTGRES_DB: taskosaur
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U taskosaur"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - taskosaur-network
    restart: unless-stopped

  # Redis for Bull Queue
  redis:
    image: redis:7
    command: redis-server --requirepass "redis_password_change_this"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - taskosaur-network
    restart: unless-stopped

  # Taskosaur Application
  app:
    image: taskosaur/taskosaur:latest
    environment:
      # Node Environment
      NODE_ENV: production

      # Database Configuration
      DATABASE_URL: postgresql://taskosaur:taskosaur_password_change_this@postgres:5432/taskosaur

      # Redis Configuration
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis_password_change_this

      # Application URLs
      FRONTEND_URL: http://localhost:3000
      CORS_ORIGIN: http://localhost:3000
      NEXT_PUBLIC_API_BASE_URL: http://localhost:3000/api

      # Security - CHANGE THESE VALUES!
      JWT_SECRET: your-secure-jwt-secret-minimum-32-characters
      JWT_REFRESH_SECRET: your-secure-refresh-secret-minimum-32-characters
      JWT_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 7d
      ENCRYPTION_KEY: your-64-character-hex-encryption-key-change-this

      # Email Configuration (optional)
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER:-}
      SMTP_PASS: ${SMTP_PASS:-}
      SMTP_FROM: ${SMTP_FROM:-noreply@taskosaur.com}

      # File Upload
      UPLOAD_DEST: ./uploads
      MAX_FILE_SIZE: 10485760

      # Queue Configuration
      MAX_CONCURRENT_JOBS: 5
      JOB_RETRY_ATTEMPTS: 3
    ports:
      - "3000:3000"
    volumes:
      - app_uploads:/app/taskosaur/uploads
      - app_logs:/app/taskosaur/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - taskosaur-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  postgres_data:
  redis_data:
  app_uploads:
  app_logs:

networks:
  taskosaur-network:
    driver: bridge
```

### Start the Stack

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop services
docker compose down

# Stop and remove all data
docker compose down -v
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/taskosaur` |
| `REDIS_HOST` | Redis hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Your secure random string |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Your secure random string |
| `ENCRYPTION_KEY` | Data encryption key (64 hex chars) | Your secure hex string |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend URL for links |
| `CORS_ORIGIN` | `http://localhost:3000` | CORS allowed origin |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3000/api` | API endpoint URL |
| `REDIS_PASSWORD` | _(empty)_ | Redis password |
| `SMTP_HOST` | _(empty)_ | SMTP server for emails |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | _(empty)_ | SMTP username |
| `SMTP_PASS` | _(empty)_ | SMTP password |
| `SMTP_FROM` | `noreply@taskosaur.com` | Email sender address |
| `UPLOAD_DEST` | `./uploads` | File upload directory |
| `MAX_FILE_SIZE` | `10485760` | Max upload size (bytes) |
| `MAX_CONCURRENT_JOBS` | `5` | Max concurrent background jobs |
| `JOB_RETRY_ATTEMPTS` | `3` | Job retry attempts |
| `JWT_EXPIRES_IN` | `15m` | JWT token expiration |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiration |

## Generating Secure Secrets

```bash
# Generate JWT secrets (32+ characters recommended)
openssl rand -base64 32

# Generate encryption key (64 hex characters)
openssl rand -hex 32
```

## Volumes

The image uses the following volumes:

- `/app/taskosaur/uploads` - User uploaded files
- `/app/taskosaur/logs` - Application logs

## Ports

- `3000` - Combined frontend and backend (Next.js serves both)

## Health Check

The image includes a health check endpoint:

```bash
curl http://localhost:3000/api/health
```

## Conversational AI Task Execution Setup

After starting Taskosaur, enable conversational AI for in-app task execution:

1. **Navigate to Settings** → Organization Settings → AI Assistant Settings
2. **Add your LLM API key** from any provider:
   - OpenRouter (100+ models): `https://openrouter.ai/api/v1`
   - OpenAI: `https://api.openai.com/v1`
   - Anthropic: `https://api.anthropic.com/v1`
   - Local AI (Ollama): Your local endpoint
3. **Start using conversational AI in-app** - Open the AI chat panel and have natural conversations to execute tasks:
   - "Create sprint with high-priority bugs from last week"
   - "Set up Q1 marketing workspace with 3 projects"
   - "Move all overdue tasks to next sprint"

## Version Tags

- `latest` - Latest stable release
- `0.1.0` - Specific version
- `0.1.0-<git-sha>` - Version with git commit hash

## Production Deployment

### Security Checklist

- [ ] Change all default passwords
- [ ] Generate secure JWT secrets (32+ characters)
- [ ] Generate secure encryption key (64 hex characters)
- [ ] Use strong database password
- [ ] Use strong Redis password
- [ ] Set up HTTPS with reverse proxy (Nginx/Caddy)
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Enable Docker log rotation

### Reverse Proxy Example (Nginx)

```nginx
server {
    listen 80;
    server_name taskosaur.example.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Backup and Restore

### Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U taskosaur taskosaur > backup.sql

# Backup uploads
docker compose cp app:/app/taskosaur/uploads ./uploads_backup
```

### Restore

```bash
# Restore PostgreSQL
docker compose exec -T postgres psql -U taskosaur taskosaur < backup.sql

# Restore uploads
docker compose cp ./uploads_backup app:/app/taskosaur/uploads
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs app

# Check health status
docker compose ps
```

### Database connection issues

```bash
# Verify PostgreSQL is healthy
docker compose ps postgres

# Test connection
docker compose exec postgres psql -U taskosaur -d taskosaur -c "SELECT 1;"
```

### Reset database

```bash
# Connect to container
docker compose exec app sh

# Run reset (WARNING: Deletes all data!)
npm run db:reset
```

### Port conflicts

If port 3000 is already in use, change the port mapping in docker-compose.yml:

```yaml
ports:
  - "8080:3000"  # Use port 8080 instead
```

## Links

- **GitHub**: https://github.com/Taskosaur/Taskosaur
- **Documentation**: https://github.com/Taskosaur/Taskosaur#readme
- **Issues**: https://github.com/Taskosaur/Taskosaur/issues
- **Discord**: https://discord.gg/5cpHUSxePp
- **License**: Business Source License (BSL)

## Support

- Email: support@taskosaur.com
- Discord: [Join our community](https://discord.gg/5cpHUSxePp)
- GitHub Issues: [Report bugs](https://github.com/Taskosaur/Taskosaur/issues)

---

**Built by the Taskosaur team** | Licensed under Business Source License
