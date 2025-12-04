# ===========================================
# CS2 Analytics API - Multi-stage Dockerfile
# ===========================================

# ============================================================================
# Base Stage
# ============================================================================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev libc6-compat
RUN corepack enable && corepack prepare pnpm@9 --activate

# ============================================================================
# Dependencies Stage
# ============================================================================
FROM base AS deps

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ============================================================================
# Builder Stage
# ============================================================================
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules

# Copy source files
COPY . .

# Generate Prisma client
RUN pnpm --filter @cs2-analytics/db exec prisma generate

# Build packages in order
RUN pnpm --filter @cs2-analytics/types build || true
RUN pnpm --filter @cs2-analytics/db build || true
RUN pnpm --filter @cs2-analytics/api build

# ============================================================================
# Production Stage
# ============================================================================
FROM node:20-alpine AS production

# Add labels
LABEL org.opencontainers.image.source="https://github.com/antoinevanloo/cs2-analytics"
LABEL org.opencontainers.image.description="CS2 Analytics API"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json

# Copy node_modules (production only)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/main.js"]

# ============================================================================
# Development Stage
# ============================================================================
FROM builder AS development

ENV NODE_ENV=development
EXPOSE 3000

CMD ["pnpm", "--filter", "@cs2-analytics/api", "run", "dev"]
