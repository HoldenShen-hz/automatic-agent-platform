import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = process.cwd();

test("dockerfile defines a multi-stage non-root runtime image", () => {
  const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");

  assert.match(dockerfile, /^FROM node:22-bookworm-slim AS build/m);
  assert.match(dockerfile, /^FROM node:22-bookworm-slim AS runtime/m);
  assert.match(dockerfile, /RUN npm ci/);
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /COPY --from=build(?: --chown=node:node)? \/app\/dist \.\/dist/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /CMD \["node", "--enable-source-maps", "dist\/src\/sdk\/cli\/api-server\.js"\]/);
});

test("ci workflow runs install typecheck tests and stable validation", () => {
  const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");

  assert.match(workflow, /uses: actions\/checkout@v4/);
  assert.match(workflow, /uses: actions\/setup-node@v4/);
  assert.match(workflow, /node-version: \[20,\s*22\]/);
  assert.match(workflow, /\${{ matrix\.node-version }}/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /npm audit --audit-level=high --omit=dev --json/);
  assert.match(workflow, /run: npm run typecheck/);
  assert.match(workflow, /run: npm run changelog:check/);
  assert.match(workflow, /run: npm run test:raw/);
  assert.match(workflow, /name: Coverage Gate/);
  assert.match(workflow, /run: npm run coverage:gate/);
  assert.match(workflow, /AA_VALIDATION_ITERATIONS=2 npm run validate:stable/);
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
  assert.match(compose, /^  redis:$/m);
  assert.match(compose, /image:\s+redis:7-alpine/);
  assert.match(compose, /test:\s+\["CMD", "redis-cli", "ping"\]/);
  assert.match(compose, /AA_STORAGE_DRIVER:\s+\$\{AA_STORAGE_DRIVER:-sqlite\}/);
});

test("publish and deploy workflows require secret refs and environment-scoped secret injection", () => {
  const publishWorkflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "publish-image.yml"), "utf8");
  const deployWorkflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "deploy-environment.yml"), "utf8");

  assert.match(publishWorkflow, /registry_secret_ref:/);
  assert.match(publishWorkflow, /environment:\s*\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.environment \|\| 'prod' \}\}/);
  // publish-image.yml uses GITHUB_TOKEN for container registry auth
  assert.match(publishWorkflow, /secrets\.GITHUB_TOKEN/);
  assert.match(publishWorkflow, /docker login "\$\{REGISTRY_HOST\}"/);
  assert.match(deployWorkflow, /deployment_secret_ref:/);
  assert.match(deployWorkflow, /config_bundle_ref:/);
  assert.match(deployWorkflow, /DEPLOYMENT_AUTH_TOKEN/);
});
