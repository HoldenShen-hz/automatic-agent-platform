import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
test("dockerignore excludes repo data and formal docs from container build context", () => {
    const dockerignore = readFileSync(join(REPO_ROOT, ".dockerignore"), "utf8");
    assert.match(dockerignore, /^\.git$/m);
    assert.match(dockerignore, /^node_modules$/m);
    assert.match(dockerignore, /^dist$/m);
    assert.match(dockerignore, /^data$/m);
    assert.match(dockerignore, /^docs_zh$/m);
    assert.match(dockerignore, /^docs_en$/m);
});
test("runtime image does not copy tests or docs and runs as non-root", () => {
    const dockerfile = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
    assert.doesNotMatch(dockerfile, /COPY --from=build \/app\/tests/);
    assert.doesNotMatch(dockerfile, /COPY --from=build \/app\/docs_zh/);
    assert.doesNotMatch(dockerfile, /COPY --from=build \/app\/docs_en/);
    assert.match(dockerfile, /^USER node$/m);
});
test("release workflows never inline registry or deployment secrets and only pass secret refs", () => {
    const publishWorkflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "publish-image.yml"), "utf8");
    const deployWorkflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "deploy-environment.yml"), "utf8");
    assert.doesNotMatch(publishWorkflow, /ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]+/);
    assert.doesNotMatch(deployWorkflow, /ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]+/);
    assert.match(publishWorkflow, /registry_secret_ref/);
    assert.match(deployWorkflow, /deployment_secret_ref/);
    assert.match(deployWorkflow, /config_bundle_ref/);
});
test("helm chart supports external secret materialization instead of cleartext prod secrets", () => {
    const externalSecretTemplate = readFileSync(join(REPO_ROOT, "deploy", "helm", "automatic-agent", "templates", "externalsecret.yaml"), "utf8");
    const values = readFileSync(join(REPO_ROOT, "deploy", "helm", "automatic-agent", "values.yaml"), "utf8");
    const secretTemplate = readFileSync(join(REPO_ROOT, "deploy", "helm", "automatic-agent", "templates", "secret.yaml"), "utf8");
    assert.match(externalSecretTemplate, /kind:\s+ExternalSecret/);
    assert.match(externalSecretTemplate, /secretStoreRef:/);
    assert.match(values, /externalSecret:/);
    assert.match(values, /enabled:\s+false/);
    assert.match(secretTemplate, /not \.Values\.externalSecret\.enabled/);
});
test("production runbook documents at least ten alert scenarios", () => {
    const runbook = readFileSync(join(REPO_ROOT, "deploy", "runbooks", "production-alert-runbook.md"), "utf8");
    const sections = runbook.match(/^##\s+\d+\./gm) ?? [];
    assert.ok(sections.length >= 10);
    assert.match(runbook, /Worker Mass Disconnect/);
    assert.match(runbook, /Canary Health Regression/);
});
//# sourceMappingURL=container-boundary.test.js.map