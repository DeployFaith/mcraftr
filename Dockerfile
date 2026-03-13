FROM node:22-alpine AS deps
WORKDIR /app
# Native build tools required by better-sqlite3
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as non-root user — UIDs are pinned so the host data/ volume mount
# (chowned to 100:101) stays accessible across image rebuilds.
RUN apk add --no-cache su-exec && addgroup -S -g 101 mcraftr && adduser -S -u 100 -G mcraftr mcraftr

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/sidecar ./sidecar
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# Copy node_modules from deps stage (compiled for Alpine musl, not host glibc)
# This ensures better-sqlite3 native addon runs correctly
COPY --from=deps /app/node_modules ./node_modules

RUN chown -R mcraftr:mcraftr /app

EXPOSE 3050
ENV PORT=3050
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
