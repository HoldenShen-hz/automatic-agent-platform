FROM node:22.21.1-bookworm-slim@sha256:25b386ea92e27c88cf6414e8581962f90c9ba72615120c94bc7de69a07f9d01e AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.build.json tsconfig.build-test.json tsconfig.scripts.json ./
COPY ui/package.json ui/package-lock.json ui/tsconfig.json ./ui/
COPY scripts ./scripts

RUN npm ci

COPY src ./src
COPY config ./config
COPY divisions ./divisions

RUN npm run build

FROM node:22.21.1-bookworm-slim@sha256:25b386ea92e27c88cf6414e8581962f90c9ba72615120c94bc7de69a07f9d01e AS runtime

ARG BUILD_DATE=""
ARG VCS_REF=""

LABEL org.opencontainers.image.title="automatic-agent-platform" \
  org.opencontainers.image.description="Automatic agent platform runtime image" \
  org.opencontainers.image.licenses="MIT" \
  org.opencontainers.image.source="https://github.com/HoldenShen-hz/automatic-agent-platform" \
  org.opencontainers.image.created="${BUILD_DATE}" \
  org.opencontainers.image.revision="${VCS_REF}"

ENV NODE_ENV=production
ENV HOME=/home/node
ENV TMPDIR=/tmp
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/divisions ./divisions

RUN mkdir -p /app /app/data /tmp && chown -R node:node /app /tmp

USER node

EXPOSE 3000

ENV AA_API_HOST=0.0.0.0
ENV AA_API_PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.AA_API_PORT || '3000') + '/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["tini", "--"]
CMD ["node", "--enable-source-maps", "dist/src/sdk/cli/api-server.js"]
