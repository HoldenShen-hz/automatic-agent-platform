FROM node:22.21.1-bookworm-slim@sha256:25b386ea92e27c88cf6414e8581962f90c9ba72615120c94bc7de69a07f9d01e AS deps

WORKDIR /app

RUN mkdir -p /app && chown -R node:node /app
USER node

COPY package.json package-lock.json tsconfig.json tsconfig.build.json tsconfig.scripts.json ./
COPY ui/package.json ui/package-lock.json ui/tsconfig.json ./ui/
COPY scripts ./scripts

RUN npm ci --ignore-scripts

FROM deps AS build

COPY src ./src
COPY tests/helpers ./tests/helpers
COPY config ./config
COPY divisions ./divisions

RUN npm run build

FROM deps AS runtime-deps

RUN npm prune --omit=dev && npm cache clean --force

FROM node:22.21.1-bookworm-slim@sha256:25b386ea92e27c88cf6414e8581962f90c9ba72615120c94bc7de69a07f9d01e AS runtime

ARG BUILD_DATE=""
ARG VCS_REF=""
ARG TARGETARCH
ARG TINI_VERSION="v0.19.0"

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

RUN case "${TARGETARCH}" in \
    amd64) export TINI_ARCH="amd64" TINI_SHA256="93dcc18a4f3401bffab6c7314a2c364fd0a010ab4d1aa1acbccd8d1001641248" ;; \
    arm64) export TINI_ARCH="arm64" TINI_SHA256="07952557df20bfdc67a8a1e2ea4c759962bb5261ea5a8780e3f0780d7a70da74" ;; \
    *) echo "Unsupported TARGETARCH for pinned tini bootstrap: ${TARGETARCH}" >&2; exit 1 ;; \
  esac \
  && export TINI_URL="https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini-${TINI_ARCH}" \
  && node --input-type=module <<'EOF'
import { createHash } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";

const response = await fetch(process.env.TINI_URL);
if (!response.ok) {
  throw new Error(`docker.tini_download_failed:${response.status}`);
}

const binary = Buffer.from(await response.arrayBuffer());
const actualSha256 = createHash("sha256").update(binary).digest("hex");
if (actualSha256 !== process.env.TINI_SHA256) {
  throw new Error(`docker.tini_checksum_mismatch:${actualSha256}`);
}

writeFileSync("/usr/local/bin/tini", binary);
chmodSync("/usr/local/bin/tini", 0o755);
EOF

RUN /usr/local/bin/tini --version

COPY package.json package-lock.json ./
COPY --from=runtime-deps --chown=node:node /app/node_modules ./node_modules

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

ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/src/sdk/cli/api-server.js"]
