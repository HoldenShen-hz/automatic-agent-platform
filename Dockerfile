FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY scripts ./scripts

RUN npm ci

COPY src ./src
COPY tests ./tests
COPY config ./config
COPY divisions ./divisions
COPY AGENTS.md CLAUDE.md ./

RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOME=/home/node
ENV TMPDIR=/tmp
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/divisions ./divisions
COPY --from=build --chown=node:node /app/AGENTS.md ./AGENTS.md
COPY --from=build --chown=node:node /app/CLAUDE.md ./CLAUDE.md

RUN mkdir -p /app/data /tmp && chown node:node /app/data /tmp

USER node

EXPOSE 3000

ENV AA_API_HOST=0.0.0.0
ENV AA_API_PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.AA_API_PORT || '3000') + '/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/src/sdk/cli/api-server.js"]
