# ============================================================
# NexusFTP Backend - Dockerfile
# Single stage: Node.js production server
# ============================================================

FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (ssh2)
RUN apk add --no-cache python3 make g++ openssl-dev

# Copy dependency files
COPY package.json package-lock.json ./

# Install all dependencies for build
RUN npm ci && npm cache clean --force

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies and build tools
RUN npm prune --omit=dev && \
    apk del python3 make g++ && \
    rm -rf /root/.npm /tmp/*

# Create data and log directories
RUN mkdir -p /app/data/trash /app/logs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "dist/server.cjs"]
