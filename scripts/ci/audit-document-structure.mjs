import { existsSync, readFileSync } from "node:fs";

const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function contains(path, patterns) {
  if (!existsSync(path)) {
    return false;
  }
  const content = read(path);
  return patterns.every((pattern) => pattern.test(content));
}

check("core runtime legacy boundary", contains("src/core/runtime/README.md", [/compat/i, /five-plane/i]), "core runtime README points to five-plane runtime boundary");
check("platform module boundary", contains("src/platform/README.md", [/five-plane/i, /contracts/i]), "platform README documents module responsibilities");
check("platform bootstrap boundary", contains("src/platform/README.md", [/platform-mainline-bootstrap/, /platform-module-catalog/]), "platform README documents bootstrap ownership");
check("domains boundary", contains("src/domains/README.md", [/domain/i, /registry/i]), "domains README documents registry/domain scope");
check("contracts boundary", contains("src/platform/contracts/README.md", [/contract/i, /canonical/i]), "contracts README documents canonical contract boundary");
check("execution dispatcher boundary", contains("src/platform/five-plane-execution/dispatcher/README.md", [/dispatch/i]), "dispatcher README exists");
check("execution engine boundary", contains("src/platform/five-plane-execution/execution-engine/README.md", [/execution/i]), "execution-engine README exists");
check("tool executor boundary", contains("src/platform/five-plane-execution/tool-executor/README.md", [/tool/i, /sandbox|scope/i]), "tool-executor README documents scope");
check("recovery boundary", contains("src/platform/five-plane-execution/recovery/README.md", [/recovery/i]), "recovery README exists");
check("ha lease split", contains("src/platform/five-plane-execution/ha/README.md", [/leader|leadership/i]) && contains("src/platform/five-plane-execution/lease/README.md", [/lease|ownership/i]), "HA and lease README files split responsibilities");
check("events boundary", contains("src/platform/five-plane-state-evidence/events/README.md", [/event/i, /durable|typed/i]), "events README exists");
check("memory boundary", contains("src/platform/five-plane-state-evidence/memory/README.md", [/memory/i]), "memory README exists");
check("truth boundary", contains("src/platform/five-plane-state-evidence/truth/README.md", [/truth|storage/i]), "truth README exists");
check("checkpoints boundary", contains("src/platform/five-plane-state-evidence/checkpoints/README.md", [/checkpoint/i]), "checkpoints README exists");
check("harness boundary", contains("src/platform/five-plane-orchestration/harness/README.md", [/harness/i]), "harness README exists");
check("oapeflir boundary", contains("src/platform/five-plane-orchestration/oapeflir/README.md", [/oapeflir|loop/i]) && contains("src/platform/five-plane-execution/oapeflir/README.md", [/oapeflir/i]), "OAPEF/LIR README files exist");

check("ui workspace guide", contains("ui/README.md", [/Cross-Platform UI Workspace/, /packages\/features\/README\.md/]), "UI README links feature docs");
check("ui apps guide", contains("ui/apps/README.md", [/apps/i, /web|mobile|electron|tauri/i]), "UI apps README documents shells");
check("ui features guide", contains("ui/packages/features/README.md", [/feature/i, /validation|test/i]), "UI feature README documents validation");
check("ui i18n exports", contains("ui/packages/shared/i18n/package.json", [/"exports"/, /"types"/]), "@aa/shared-i18n has package export");
check("ui telemetry exports", contains("ui/packages/shared/telemetry/package.json", [/"exports"/, /"types"/]), "@aa/shared-telemetry has package export");

check("api client docs", contains("docs_zh/reference/api-client.md", [/API/i, /SDK|client/i]), "API client reference exists");
check("api versioning docs", contains("docs_zh/reference/api-versioning.md", [/\/api\/v1/, /OpenAPI/]), "API versioning reference exists");
check("environment docs", contains("docs_zh/reference/environment-configuration.md", [/config\/security/, /\.env\.example/]), "environment configuration reference exists");
check("docs sync guide", contains("docs_zh/reference/docs-sync.md", [/docs_zh|docs_en/i]), "docs sync reference exists");
check("review maintenance guide", contains("docs_zh/reviews/README.md", [/治理项/, /证据/]), "review README documents evidence rules");
check("code governance guide", contains("docs_zh/quality/code-governance.md", [/巨型文件/, /console/, /any/]), "code governance guide documents global cleanup boundaries");
check("mutation strategy", contains("docs_zh/quality/mutation-coverage-strategy.md", [/mutation|Stryker/i]), "mutation strategy exists");
check("test exclusion audit", contains("docs_zh/quality/test-exclusion-audit.md", [/exclude|测试/i]), "test exclusion audit exists");

check("scripts guide", contains("scripts/README.md", [/set -euo pipefail/, /Do not store secrets/]), "scripts README documents shell safety");
check("translate docs maintenance note", contains("translate_docs.py", [/legacy batch translation helper/, /Do not place API tokens/]), "translate_docs.py documents legacy scope and secret rule");
check("sqlite backup safety", contains("scripts/backup-sqlite.sh", [/set -euo pipefail/, /integrity_check/, /backup_lock/]), "backup-sqlite.sh has strict mode, integrity check, and lock");
check("sqlite restore safety", contains("scripts/restore-sqlite.sh", [/set -euo pipefail/, /integrity_check/, /pre-restore/]), "restore-sqlite.sh has strict mode, integrity check, and pre-restore snapshot");
check("npm scripts guide", contains("docs_zh/operations/npm-scripts.md", [/package\.json/, /script/i]), "npm scripts documentation exists");
check("golden guide", contains("tests/golden/README.md", [/Golden/, /Validation/]), "golden test README exists");
check("performance guide", contains("tests/performance/README.md", [/Performance/, /baseline/i]), "performance README exists");
check("integration guide", contains("tests/integration/README.md", [/integration/i, /External Services/, /environment variables/]), "integration README documents external service rules");
check("e2e guide", contains("tests/e2e/README.md", [/e2e|end-to-end/i]), "e2e README exists");
check("unit guide", contains("tests/unit/README.md", [/unit/i]), "unit README exists");
check("invariant guide", contains("tests/invariants/README.md", [/Invariant/, /contract|architecture/i]), "invariant README exists");

check("dr runbook", contains("docs_zh/operations/disaster-recovery-runbook.md", [/RTO|RPO|恢复|演练/i]), "DR runbook exists");
check("postmortem template", contains("docs_zh/operations/postmortem-template.md", [/postmortem|复盘|事故/i]), "postmortem template exists");
check("deploy runbooks", contains("deploy/runbooks/README.md", [/runbook|rollback|alert/i]), "deploy runbooks README exists");
check("chaos guide", contains("deploy/chaos/README.md", [/chaos|approval|停止/i]), "chaos README exists");
check("kubernetes guide", contains("deploy/kubernetes/manifests/README.md", [/Kubernetes|manifest|smoke/i]), "Kubernetes manifest README exists");

check("env secret guidance", contains(".env.example", [/AA_API_JWT_SECRET/, /Do not commit real values/, /AA_STORAGE_DRIVER/]), ".env.example documents secrets and storage driver");
check("package version guard", contains("package.json", [/"engines"/, /"node":\s*">=20 <23"/]), "package.json declares Node/npm version guard");
check("no root memory temp files", !existsSync(":memory:aa-truth-status-1778381158760") && !existsSync("tsconfig.temp.json"), "known root temp files are absent");

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`document structure audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`document structure audit passed: ${checks.length}/${checks.length}`);
