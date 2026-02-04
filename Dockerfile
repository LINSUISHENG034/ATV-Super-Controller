# Stage 1: Build stage for dependencies
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install production dependencies only with explicit omit flags
# Note: npm ci --only=production is deprecated, using --omit=dev instead
RUN npm ci --omit=dev

# Stage 2: Runtime stage (smaller final image)
FROM node:18-alpine

# Metadata labels
LABEL maintainer="Link"
LABEL version="1.0.0"
LABEL description="ATV-Super-Controller - Android TV scheduler and controller for automation over ADB TCP"

# Add non-root user for security
# NOTE: When mounting config volume, ensure host directory is readable by UID 1001
#       or use `docker run --user $(id -u):$(id -g)` to match host user
RUN addgroup -g 1001 -S atvuser && \
    adduser -S -u 1001 -G atvuser atvuser

# Set working directory
WORKDIR /app

# Copy node_modules from builder stage with correct ownership
COPY --from=builder --chown=atvuser:atvuser /app/node_modules ./node_modules

# Copy package files (for version info)
COPY --chown=atvuser:atvuser package.json package-lock.json ./

# Copy application source code
COPY --chown=atvuser:atvuser src/ ./src/
COPY --chown=atvuser:atvuser schemas/ ./schemas/
COPY --chown=atvuser:atvuser config.example.json ./

# Create directory for runtime config (will be mounted as volume)
RUN mkdir -p /app/config && \
    chown -R atvuser:atvuser /app/config

# Switch to non-root user
USER atvuser

# Health check - verify ADB device connectivity
# This validates actual device connection, not just CLI responsiveness
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD ["node", "src/health-check.js"]

# Set default environment variables
ENV NODE_ENV=production
ENV ATV_LOG_LEVEL=info
ENV ATV_CONFIG_PATH=/app/config/config.json

# Entry point - CLI application
ENTRYPOINT ["node", "src/index.js"]

# Default command shows help
CMD ["--help"]
