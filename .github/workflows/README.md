# GitHub Actions Workflows

## Docker Build and Push

Automatically builds and pushes multi-architecture Docker images to Docker Hub.

### Trigger Events

- **Push to `development` branch** → Builds and pushes `taskosaur/taskosaur:development`
- **Push to `latest` branch** → Builds and pushes `taskosaur/taskosaur:latest`

### Docker Tags

Each build creates two tags:
1. **Branch tag**: `development` or `latest`
2. **Version tag**: `{version}-{git-sha}` (e.g., `0.1.0-a1b2c3d`)

### Supported Architectures

- `linux/amd64` (Intel/AMD x86-64)
- `linux/arm64` (ARM 64-bit - Apple Silicon, AWS Graviton)

### Setup Instructions

#### 1. Create Docker Hub Access Token

1. Log in to [Docker Hub](https://hub.docker.com/)
2. Go to **Account Settings** → **Security** → **Access Tokens**
3. Click **New Access Token**
4. Name: `github-actions-taskosaur`
5. Permissions: **Read & Write**
6. Copy the generated token

#### 2. Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add two secrets:

| Secret Name | Value |
|-------------|-------|
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | The access token from step 1 |

#### 3. Push to Trigger Build

```bash
# For development builds
git push origin development

# For latest/stable builds
git push origin latest
```

### Workflow Features

- **Multi-architecture builds** using Docker Buildx and QEMU
- **Layer caching** for faster builds (cached per branch)
- **Build summaries** with pull commands in GitHub Actions UI
- **Version tagging** from package.json
- **Build numbers** from GitHub Actions run number

### Manual Trigger (Optional)

To enable manual workflow dispatch, add this to the workflow file:

```yaml
on:
  push:
    branches:
      - development
      - latest
  workflow_dispatch:
    inputs:
      branch_tag:
        description: 'Docker tag to use'
        required: true
        default: 'development'
```

### Monitoring Builds

View build status:
- Go to **Actions** tab in GitHub repository
- Click on the latest **Docker Build and Push** workflow run
- Check the summary for image tags and pull commands

### Testing the Image

After a successful build:

```bash
# Pull the image
docker pull taskosaur/taskosaur:development

# Test it locally
docker run -p 3000:3000 taskosaur/taskosaur:development
```

### Troubleshooting

**Build fails with authentication error:**
- Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are set correctly
- Ensure the Docker Hub access token has Read & Write permissions

**Multi-arch build is slow:**
- First builds are slower due to QEMU emulation
- Subsequent builds use layer caching and are much faster

**Cache not working:**
- Ensure your Docker Hub account has enough storage
- Cache is stored as a separate image tag: `buildcache-{branch}`

### Cache Management

The workflow stores build cache in Docker Hub with tags:
- `buildcache-development`
- `buildcache-latest`

These can be deleted from Docker Hub if needed to save space, but builds will be slower next time.
