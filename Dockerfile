# Synopticon API - Docker Container
# Minimal container with Bun runtime for optimal performance
# Base image: ~40MB, Total container: ~180MB

FROM oven/bun:1-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for audio/video processing and security
RUN apk add --no-cache \
    ca-certificates \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S synopticon && \
    adduser -S synopticon -u 1001 -G synopticon

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Remove unnecessary files to reduce image size
RUN rm -rf \
    tests/ \
    demos/ \
    examples/ \
    docs/ \
    .git/ \
    .github/ \
    *.md \
    .env* \
    docker-compose.yml

# Set proper ownership
RUN chown -R synopticon:synopticon /app

# Switch to non-root user
USER synopticon

# Environment variables with container-friendly defaults
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV LLM_API_URL=http://host.docker.internal:11434
ENV LLM_BACKEND=mock
ENV CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Expose port
EXPOSE 3000

# Default command - can be overridden
CMD ["bun", "run", "speech-analysis-server.js"]

# Build metadata
LABEL org.opencontainers.image.title="Synopticon API"
LABEL org.opencontainers.image.description="Open-source platform for real-time multi-modal behavioral analysis"
LABEL org.opencontainers.image.version="0.5.1"
LABEL org.opencontainers.image.source="https://github.com/username/synopticon-api"
LABEL org.opencontainers.image.licenses="MIT"