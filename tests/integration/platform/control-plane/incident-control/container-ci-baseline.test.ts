import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = process.cwd();

test("dockerfile defines a multi-stage non-root runtime image", () => {
  const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");

  assert.match(dockerfile, /^FROM node:22\.21\.1-bookworm-slim@sha256:[0-9a-f]{64} AS deps$/m);
  assert.match(dockerfile, /^FROM deps AS build$/m);
  assert.match(dockerfile, /^FROM deps AS runtime-deps$/m);
  assert.match(dockerfile, /^FROM node:22\.21\.1-bookworm-slim@sha256:[0-9a-f]{64} AS runtime$/m);
  assert.match(dockerfile, /RUN npm ci --ignore-scripts/);
  assert.match(dockerfile, /RUN npm prune --omit=dev/);
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /tsconfig\.build\.json/);
  assert.match(dockerfile, /tsconfig\.scripts\.json/);
  assert.match(dockerfile, /ARG TINI_VERSION="v0\.19\.0"/);
  assert.match(dockerfile, /TINI_SHA256/);
  assert.match(dockerfile, /org\.opencontainers\.image\.title/);
  assert.match(dockerfile, /ENTRYPOINT \["\/usr\/local\/bin\/tini", "--"\]/);
  assert.match(dockerfile, /COPY --from=runtime-deps(?: --chown=node:node)? \/app\/node_modules \.\/node_modules/);
  assert.match(dockerfile, /COPY --from=build(?: --chown=node:node)? \/app\/dist \.\/dist/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /CMD \["node", "--enable-source-maps", "dist\/src\/sdk\/cli\/api-server\.js"\]/);
});

test("ci workflow runs install typecheck tests and stable validation", () => {
  const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");

  assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /uses: actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /run: npm ci --ignore-scripts/);
  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /npm audit --audit-level=high --omit=dev --json/);
  assert.match(workflow, /run: npm run typecheck/);
  assert.match(workflow, /run: npm run changelog:check/);
  assert.match(workflow, /AA_RUNNING_TESTS:\s*"1"/);
  assert.match(workflow, /run: npm run test:raw/);
  assert.match(workflow, /name: Coverage Gate/);
  assert.match(workflow, /run: npm run coverage:gate/);
  assert.match(workflow, /AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  assert.match(workflow, /terraform fmt -check -recursive/);
  assert.match(workflow, /terraform validate/);
});

test("docker compose includes postgres service for production-like local validation", () => {
  const compose = readFileSync(join(REPO_ROOT, "docker-compose.yml"), "utf8");

  assert.match(compose, /^  api-server:$/m);
  assert.match(compose, /read_only:\s+true/);
  assert.match(compose, /tmpfs:\n\s+- \/tmp:size=64m,mode=1777/);
  assert.match(compose, /healthcheck:\n\s+test:\s+\["CMD", "node", "-e"/);
  assert.match(compose, /cap_drop:\n\s+- ALL/);
  assert.match(compose, /security_opt:\n\s+- no-new-privileges:true/);
  assert.match(compose, /mem_limit:\s+512m/);
  assert.match(compose, /pids_limit:\s+256/);
  assert.match(compose, /^  postgres:$/m);
  assert.match(compose, /image:\s+postgres:16-bookworm/);
  assert.match(compose, /POSTGRES_DB:\s+automatic_agent/);
  assert.match(compose, /POSTGRES_PASSWORD:\s+\$\{POSTGRES_PASSWORD:\?required\}/);
  assert.match(compose, /device:\s+\$\{AA_POSTGRES_DATA_DIR:-\.\/data\/docker\/postgres\}/);
  assert.match(compose, /^  redis:$/m);
  assert.match(compose, /image:\s+redis:7-alpine/);
  assert.match(compose, /test:\s+\["CMD", "redis-cli", "-a", "\$\{AA_REDIS_PASSWORD:\?required\}", "ping"\]/);
  assert.match(compose, /AA_STORAGE_DRIVER:\s+\$\{AA_STORAGE_DRIVER:-sqlite\}/);
  assert.match(compose, /prometheus:[\s\S]*healthcheck:/);
  assert.match(compose, /prom\/prometheus:v3\.5\.3@sha256:[0-9a-f]{64}/);
  assert.match(compose, /prom\/alertmanager:v0\.32\.1@sha256:[0-9a-f]{64}/);
});

test("publish and deploy workflows require secret refs and environment-scoped secret injection", () => {
  const publishWorkflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "publish-image.yml"), "utf8");
  const deployWorkflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "deploy-environment.yml"), "utf8");

  assert.match(publishWorkflow, /registry_secret_ref:/);
  assert.match(publishWorkflow, /environment:\s*\$\{\{\s*needs\.preflight\.outputs\.deploy_environment\s*\|\|\s*'prod'\s*\}\}/);
  assert.match(publishWorkflow, /docker\/login-action@[0-9a-f]{40}/);
  assert.match(publishWorkflow, /cosign sign --yes/);
  assert.match(deployWorkflow, /deployment_secret_ref:/);
  assert.match(deployWorkflow, /config_bundle_ref:/);
  assert.match(deployWorkflow, /DEPLOYMENT_AUTH_TOKEN/);
  assert.match(deployWorkflow, /helm uninstall "automatic-agent-\$\{\{ steps\.rollout\.outputs\.inactive_slot \}\}"/);
  assert.match(deployWorkflow, /aws-actions\/configure-aws-credentials@[0-9a-f]{40}/);
  assert.match(deployWorkflow, /azure\/setup-kubectl@[0-9a-f]{40}/);
  assert.match(deployWorkflow, /azure\/setup-helm@[0-9a-f]{40}/);
});
