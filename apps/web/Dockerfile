# Dockerfile for Next.js Web App in a monorepo

# ============================================================================
# Base Stage
# ============================================================================
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN npm install -g pnpm

# ============================================================================
# Builder Stage
# ============================================================================
FROM base AS builder

# Copy all package manifests and workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/

# Install all dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy the rest of the monorepo source code
COPY . .

# Build the specific application (web)
# Set NEXT_TELEMETRY_DISABLED to avoid build hang
ENV NEXT_TELEMETRY_DISABLED 1

# Build dependencies first
RUN pnpm --filter @cs2-analytics/types build

# Build web app
RUN pnpm --filter @cs2-analytics/web build

# ============================================================================

# Production Stage

# ============================================================================

FROM base as production

WORKDIR /usr/src/app



# Set environment variables for production

ENV NODE_ENV=production

# Disable Next.js telemetry

ENV NEXT_TELEMETRY_DISABLED 1



# Create a non-root user for security

RUN addgroup --system --gid 1001 nodejs

RUN adduser --system --uid 1001 nextjs



# Copy pruned production dependencies from the builder stage

COPY --from=builder /usr/src/app/node_modules ./node_modules

COPY --from=builder --chown=nextjs:nodejs /usr/src/app/apps/web/.next ./apps/web/.next

COPY --from=builder /usr/src/app/apps/web/public ./apps/web/public

COPY --from=builder /usr/src/app/apps/web/package.json ./apps/web/package.json



USER nextjs



# Expose the port the app runs on

EXPOSE 3000



# Start the app

CMD ["pnpm", "--filter", "web", "start"]



# ============================================================================

# Development Stage

# ============================================================================

FROM builder AS development



# Set environment for development

ENV NODE_ENV=development



# Expose the port the app runs on

EXPOSE 3000



# Run the app in development mode

CMD ["pnpm", "--filter", "web", "run", "dev"]
