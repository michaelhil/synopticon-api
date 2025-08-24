# 🐳 Docker Deployment Guide - Synopticon API

Complete guide for deploying Synopticon API using Docker containers.

## 🚀 Quick Start

### Simple Deployment (External LLM)
```bash
# Start Ollama LLM service on host
ollama serve
ollama pull llama3.2

# Run Synopticon API container
docker run -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  ghcr.io/username/synopticon-api:latest
```

### Full Stack with Docker Compose
```bash
# Clone repository
git clone https://github.com/username/synopticon-api.git
cd synopticon-api

# Start full stack (API + LLM)
docker-compose up -d

# Check status
docker-compose ps
```

## 📋 Container Specifications

### Image Details
- **Base Image:** `oven/bun:1-alpine` (40MB)
- **Total Size:** ~180MB
- **Runtime:** Bun (2-3x faster startup than Node.js)
- **Architecture:** Multi-platform (amd64, arm64)
- **Registry:** GitHub Container Registry (ghcr.io)

### Included Features
- ✅ Face detection (MediaPipe)
- ✅ Speech analysis pipeline
- ✅ Audio processing
- ✅ Eye tracking integration
- ✅ RESTful API endpoints
- ✅ WebSocket support
- ✅ Performance monitoring

## ⚙️ Environment Variables

### Required Variables
```bash
HOST=0.0.0.0                    # Container binding (default)
PORT=3000                       # API port (default)
LLM_API_URL=http://host.docker.internal:11434  # External LLM
```

### Optional Variables
```bash
# LLM Configuration
LLM_BACKEND=ollama              # LLM backend: ollama, mock
LLM_MODEL=llama3.2              # Model name
LLM_BACKEND=mock                # Use for development/testing

# Networking
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SPEECH_SERVER_URL=http://localhost:3000/api/analyze
TRANSPORT_BASE_URL=http://localhost:8080
WEBSOCKET_HOST=localhost

# Eye Tracking
NEON_DEVICE_ADDRESS=localhost   # Neon eye tracker address

# Session Management  
MAX_SESSIONS=100                # Maximum concurrent sessions
SESSION_TIMEOUT=3600000         # Session timeout (ms)
```

## 📁 Configuration Files

### Environment File (`.env`)
```bash
# Create .env file for easy configuration
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
LLM_API_URL=http://host.docker.internal:11434
LLM_BACKEND=ollama
LLM_MODEL=llama3.2
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Use with Docker
```bash
docker run -p 3000:3000 --env-file .env ghcr.io/username/synopticon-api:latest
```

## 🐳 Deployment Options

### 1. Minimal Container (Recommended)
**External LLM service + Synopticon API container**

```bash
# Terminal 1: Start Ollama
ollama serve
ollama pull llama3.2

# Terminal 2: Start Synopticon API
docker run -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  -e LLM_BACKEND=ollama \
  --name synopticon-api \
  ghcr.io/username/synopticon-api:latest
```

**Pros:** Smaller container, easier updates, better resource management
**Cons:** Requires separate LLM setup

### 2. Full Stack with Docker Compose
**Everything in containers**

```yaml
# docker-compose.yml
version: '3.8'
services:
  synopticon-api:
    image: ghcr.io/username/synopticon-api:latest
    ports: ["3000:3000"]
    environment:
      LLM_API_URL: http://ollama:11434
    depends_on: [ollama]
    
  ollama:
    image: ollama/ollama:latest  
    ports: ["11434:11434"]
    volumes: ["ollama_data:/root/.ollama"]
```

**Pros:** Complete isolation, easy orchestration
**Cons:** Larger resource usage, more complex

### 3. Development Mode
**Mock LLM for testing**

```bash
docker run -p 3000:3000 \
  -e LLM_BACKEND=mock \
  -e NODE_ENV=development \
  --name synopticon-dev \
  ghcr.io/username/synopticon-api:latest
```

**Pros:** No external dependencies, fast startup
**Cons:** Mock responses only

## 🌐 Platform-Specific Instructions

### Windows (WSL2)
```bash
# Enable WSL2 Docker backend
# Use named volumes for better performance
docker run -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  -v synopticon-data:/app/data \
  ghcr.io/username/synopticon-api:latest
```

### macOS (Docker Desktop)
```bash
# Docker Desktop handles host networking
docker run -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  --memory=1g \
  ghcr.io/username/synopticon-api:latest
```

### Linux (Native Docker)
```bash
# Use --add-host for host.docker.internal
docker run -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  --add-host=host.docker.internal:host-gateway \
  ghcr.io/username/synopticon-api:latest
```

## 🔌 API Endpoints

Once deployed, the API will be available at:

### Health & Status
- `GET http://localhost:3000/health` - Health check
- `GET http://localhost:3000/api/config` - Configuration info

### Core APIs
- `POST http://localhost:3000/api/analyze` - Face analysis
- `POST http://localhost:3000/api/speech/analyze` - Speech analysis
- `WebSocket ws://localhost:3000/ws` - Real-time streaming

### Complete API Documentation
See `/API_GUIDE.md` for full endpoint documentation.

## 🔧 Advanced Configuration

### GPU Support (NVIDIA)
```bash
# Install NVIDIA Container Toolkit first
docker run --gpus all -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  ghcr.io/username/synopticon-api:latest
```

### Volume Mounts
```bash
# Persistent data and configuration
docker run -p 3000:3000 \
  -v ./config:/app/config:ro \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  ghcr.io/username/synopticon-api:latest
```

### Resource Limits
```bash
# Limit memory and CPU usage
docker run -p 3000:3000 \
  --memory=512m \
  --cpus="1.0" \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  ghcr.io/username/synopticon-api:latest
```

## 🔍 Health Monitoring

### Built-in Health Checks
```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' synopticon-api

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' synopticon-api
```

### Custom Health Monitoring
```bash
# Add custom health monitoring
docker run -p 3000:3000 \
  --health-cmd="curl -f http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  ghcr.io/username/synopticon-api:latest
```

## 📊 Production Deployment

### Docker Swarm
```yaml
# docker-stack.yml
version: '3.8'
services:
  synopticon-api:
    image: ghcr.io/username/synopticon-api:latest
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
    ports: ["3000:3000"]
    environment:
      LLM_API_URL: http://ollama:11434
```

Deploy:
```bash
docker stack deploy -c docker-stack.yml synopticon
```

### Kubernetes
```yaml
# kubernetes-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: synopticon-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: synopticon-api
  template:
    metadata:
      labels:
        app: synopticon-api
    spec:
      containers:
      - name: synopticon-api
        image: ghcr.io/username/synopticon-api:latest
        ports: [containerPort: 3000]
        env:
        - name: LLM_API_URL
          value: "http://ollama:11434"
```

### Cloud Platforms

#### AWS ECS
```json
{
  "family": "synopticon-api",
  "containerDefinitions": [{
    "name": "synopticon-api",
    "image": "ghcr.io/username/synopticon-api:latest",
    "portMappings": [{"containerPort": 3000}],
    "environment": [
      {"name": "LLM_API_URL", "value": "http://ollama:11434"}
    ]
  }]
}
```

#### Google Cloud Run
```bash
gcloud run deploy synopticon-api \
  --image=ghcr.io/username/synopticon-api:latest \
  --port=3000 \
  --set-env-vars="LLM_API_URL=http://ollama:11434"
```

## 🔒 Security Considerations

### Container Security
- ✅ **Non-root user**: Runs as `synopticon:synopticon` (UID 1001)
- ✅ **Minimal base image**: Alpine Linux for smaller attack surface
- ✅ **No unnecessary packages**: Only essential dependencies
- ✅ **Vulnerability scanning**: Automated Trivy scans in CI/CD

### Network Security
```bash
# Create isolated network
docker network create synopticon-net

# Run with custom network
docker run -p 3000:3000 \
  --network=synopticon-net \
  -e LLM_API_URL=http://ollama:11434 \
  ghcr.io/username/synopticon-api:latest
```

### Secrets Management
```bash
# Use Docker secrets (Swarm mode)
echo "your-secret-key" | docker secret create llm-api-key -

# Reference in service
docker service create \
  --secret llm-api-key \
  --env LLM_API_KEY_FILE=/run/secrets/llm-api-key \
  ghcr.io/username/synopticon-api:latest
```

## 🚨 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker logs synopticon-api

# Common solutions:
# 1. Check port conflicts
netstat -tulpn | grep 3000

# 2. Verify environment variables
docker exec synopticon-api env

# 3. Test health endpoint
curl http://localhost:3000/health
```

#### LLM Connection Issues
```bash
# Test LLM connectivity
docker exec synopticon-api curl -f http://host.docker.internal:11434/api/tags

# Common solutions:
# 1. Ensure Ollama is running on host
ollama serve

# 2. Check firewall settings
# 3. Use container networking instead
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats synopticon-api

# Check memory constraints
docker inspect synopticon-api | grep -i memory

# Increase limits if needed
docker update --memory=1g --cpus="2.0" synopticon-api
```

### Debug Mode
```bash
# Run with debug logging
docker run -p 3000:3000 \
  -e NODE_ENV=development \
  -e DEBUG=synopticon:* \
  -e LLM_BACKEND=mock \
  ghcr.io/username/synopticon-api:latest
```

### Access Container Shell
```bash
# Interactive shell for debugging
docker exec -it synopticon-api sh

# Or run temporary debug container
docker run -it --rm \
  --entrypoint sh \
  ghcr.io/username/synopticon-api:latest
```

## 🔄 Updates and Maintenance

### Update Container
```bash
# Pull latest image
docker pull ghcr.io/username/synopticon-api:latest

# Recreate container
docker stop synopticon-api
docker rm synopticon-api
docker run -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  --name synopticon-api \
  ghcr.io/username/synopticon-api:latest
```

### Backup and Restore
```bash
# Backup container data
docker cp synopticon-api:/app/data ./backup/

# Restore data
docker cp ./backup/ synopticon-api:/app/data
```

### Version Pinning
```bash
# Use specific version instead of :latest
docker run -p 3000:3000 \
  -e LLM_API_URL=http://host.docker.internal:11434 \
  ghcr.io/username/synopticon-api:v0.5.1
```

## 🔗 Integration Examples

### With Existing Services
```yaml
# Integrate with existing infrastructure
version: '3.8'
services:
  synopticon-api:
    image: ghcr.io/username/synopticon-api:latest
    environment:
      LLM_API_URL: http://existing-llm-service:11434
      CORS_ORIGINS: https://your-frontend.com
    networks: [existing-network]

networks:
  existing-network:
    external: true
```

### Research Environment
```bash
# Research setup with data persistence
docker run -p 3000:3000 \
  -v ./research-data:/app/data \
  -v ./models:/app/models:ro \
  -e LLM_BACKEND=ollama \
  -e NODE_ENV=research \
  ghcr.io/username/synopticon-api:latest
```

---

## 📞 Support

- **Documentation**: See `/API_GUIDE.md` for complete API reference
- **Issues**: https://github.com/username/synopticon-api/issues
- **Discussions**: https://github.com/username/synopticon-api/discussions

---

**🎉 You're now ready to deploy Synopticon API with Docker! Start with the Quick Start section and customize based on your needs.**