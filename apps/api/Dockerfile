# Dockerfile for NestJS API in a monorepo

# ============================================================================
# Base Stage
# ============================================================================
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache openssl openssl-dev
RUN npm install -g pnpm

# ============================================================================
# Builder Stage
# ============================================================================
FROM base AS builder

# Copy all package manifests and workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/

# Install all dependencies using pnpm (including workspace dependencies)
RUN pnpm install --frozen-lockfile

# Copy the rest of the monorepo source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @cs2-analytics/db exec prisma generate

# Build dependencies first, then the API
RUN pnpm --filter @cs2-analytics/types build
RUN pnpm --filter @cs2-analytics/db build
RUN pnpm --filter @cs2-analytics/api build

# Prune development dependencies
RUN pnpm prune --prod

# ============================================================================
# Production Stage
# ============================================================================
FROM base as production

# Copy artifacts from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /usr/src/app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /usr/src/app/packages/types/node_modules ./packages/types/node_modules
COPY --from=builder /usr/src/app/dist/apps/api ./dist/apps/api

# Copy the production package.json to the app
COPY package.json .
COPY apps/api/package.json ./apps/api/

# Set environment variables for production
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

# Start the app
CMD ["node", "dist/apps/api/main.js"]

# ============================================================================
# Development Stage
# ============================================================================
FROM builder AS development

# Set environment for development
ENV NODE_ENV=development

# Expose the port the app runs on
EXPOSE 3000

# Run the app in development mode with hot-reload
CMD ["pnpm", "--filter", "@cs2-analytics/api", "run", "dev"]
