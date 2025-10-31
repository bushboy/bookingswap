# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Build frontend and shared packages
RUN npm run build:frontend

# Production image with nginx
FROM nginx:alpine AS runner

# Copy nginx configuration
COPY apps/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Add health check script
RUN echo '#!/bin/sh' > /health-check.sh && \
    echo 'curl -f http://localhost:80/health || exit 1' >> /health-check.sh && \
    chmod +x /health-check.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD /health-check.sh

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]