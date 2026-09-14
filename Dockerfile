# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/ui/package.json ./packages/ui/package.json
# npm 11.18 correctly preserves root overrides across workspace links.
RUN npm install --global npm@11.18.0 && npm ci && npm ls uuid
COPY apps/web ./apps/web
COPY packages ./packages
COPY docs/qa ./docs/qa
COPY database/postgresql ./database/postgresql
COPY scripts/deployment ./scripts/deployment
ENV ANALIZA_CONTAINER_BUILD=1 \
    NEXT_PUBLIC_RELEASE_PROFILE=core \
    NEXT_PUBLIC_DATA_MODE=postgresql \
    ANALIZA_DATA_MODE=postgresql
# The build needs no database credentials. Secrets enter at runtime only.
RUN npm run build
RUN test -f apps/web/.next/standalone/apps/web/server.js \
    && test -d apps/web/.next/static \
    && test -d apps/web/public

# Explicit migration/seed operator; never run it from web startup or a public endpoint.
FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS operator
WORKDIR /app
ARG SOURCE_SHA=local-unversioned
LABEL org.opencontainers.image.revision=$SOURCE_SHA \
    com.analiza.operator="explicit-postgresql-migration"
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/apps/web/.next/standalone/node_modules ./node_modules
COPY --from=build --chown=node:node /app/scripts/deployment/db-command.mjs /app/scripts/deployment/operator-target.mjs ./scripts/deployment/
COPY --from=build --chown=node:node /app/database/postgresql/migrations ./database/postgresql/migrations
USER node
ENTRYPOINT ["node", "scripts/deployment/db-command.mjs"]
CMD ["--dry-run"]

FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS runtime
WORKDIR /app
ARG SOURCE_SHA=local-unversioned
LABEL org.opencontainers.image.source="https://github.com/CLinqui7/analiza-en-casa" \
    org.opencontainers.image.revision=$SOURCE_SHA \
    com.analiza.release-profile="core" \
    com.analiza.data-mode="postgresql" \
    com.analiza.schema-contract="analiza-core-v1" \
    com.analiza.cloud-sql="postgresql-18"
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 HOSTNAME=0.0.0.0 \
    ANALIZA_DATA_MODE=postgresql NEXT_PUBLIC_DATA_MODE=postgresql \
    NEXT_PUBLIC_RELEASE_PROFILE=core ANALIZA_CONTAINER_RUNTIME=1
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
STOPSIGNAL SIGTERM
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
