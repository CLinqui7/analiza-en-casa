# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm ci
COPY apps/web ./apps/web
COPY packages ./packages
COPY docs/qa ./docs/qa
ENV ANALIZA_CONTAINER_BUILD=1 \
    NEXT_PUBLIC_RELEASE_PROFILE=core \
    NEXT_PUBLIC_DATA_MODE=mongodb \
    ANALIZA_DATA_MODE=mongodb
# The build needs no database credentials. Secrets enter at runtime only.
RUN npm run build

# Optional operator image; never expose bootstrap as a web endpoint.
FROM build AS operator
WORKDIR /app/apps/web
ENTRYPOINT ["npm", "run", "mongo:bootstrap", "--"]
CMD ["--dry-run"]

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 HOSTNAME=0.0.0.0 \
    ANALIZA_DATA_MODE=mongodb NEXT_PUBLIC_DATA_MODE=mongodb \
    NEXT_PUBLIC_RELEASE_PROFILE=core
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
