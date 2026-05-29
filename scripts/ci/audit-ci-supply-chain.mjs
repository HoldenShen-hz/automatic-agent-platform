import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function collectWorkflowUses(content) {
  const matches = [];
  const usesPattern = /^\s*uses:\s*([^\s#]+)\s*$/gm;
  for (const match of content.matchAll(usesPattern)) {
    matches.push(match[1]);
  }
  return matches;
}

function isPinnedAction(ref) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?@[0-9a-f]{40}$/u.test(ref);
}

const ci = read(".github/workflows/ci.yml");
check("ci explicit permissions", /permissions:[\s\S]*contents:\s*read[\s\S]*security-events:\s*write/.test(ci), "CI declares least-privilege read plus CodeQL upload permission");
check("ci concurrency", /concurrency:[\s\S]*cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*!=\s*'schedule'\s*\}\}/.test(ci), "CI cancels superseded runs except for scheduled sweeps");
check("ci npm ci", /run:\s*npm ci/.test(ci), "CI installs from lockfile");
check("ci npm audit sarif pipeline", /npm audit --audit-level=high --omit=dev --json/.test(ci) && /upload-sarif@[0-9a-f]{40}/.test(ci), "CI converts npm audit findings into SARIF and uploads them");
check("ci typecheck", /npm run typecheck/.test(ci), "CI runs typecheck");
check("ci coverage gate", /npm run coverage:gate/.test(ci), "CI runs coverage gate");
check("ci codeql", /github\/codeql-action\/analyze@[0-9a-f]{40}/.test(ci), "CI runs CodeQL");
check(
  "ci trivy",
  /aquasecurity\/trivy-action@(?:0\.32\.0|[0-9a-f]{40})/.test(ci)
    && /IMAGE_REPOSITORY:\s*automatic-agent-platform/.test(ci)
    && /image-ref:\s*\$\{\{\s*env\.IMAGE_REGISTRY\s*\}\}\/\$\{\{\s*env\.IMAGE_REPOSITORY\s*\}\}:\$\{\{\s*env\.IMAGE_TAG\s*\}\}/.test(ci)
    && /CRITICAL,HIGH/.test(ci),
  "CI scans the same fully-qualified image naming surface used for release promotion",
);

const publish = read(".github/workflows/publish-image.yml");
check("publish environment approval", /environment:\s*\$\{\{/.test(publish), "publish job binds GitHub environment");
check("publish buildx action", /docker\/build-push-action@[0-9a-f]{40}/.test(publish), "publish uses Buildx build-push action");
check(
  "publish gha cache",
  /cache-from:\s*type=gha/.test(publish) && /cache-to:\s*type=gha,mode=(?:max|min)/.test(publish),
  "publish uses GitHub Actions Docker cache",
);
check("publish sha tag", /type=sha,prefix=sha-/.test(publish), "publish emits sha tag");
check(
  "publish explicit image tag",
  /type=raw,value=\$\{\{\s*(inputs\.image_tag|needs\.preflight\.outputs\.image_tag)\s*\}\}/.test(publish),
  "publish uses an explicit validated image tag",
);

const dockerfile = read("Dockerfile");
check("docker runtime non-root", /USER node/.test(dockerfile), "runtime container uses node user");
check("docker healthcheck", /HEALTHCHECK/.test(dockerfile), "Dockerfile declares healthcheck");
check("docker production install", /npm ci --omit=dev/.test(dockerfile), "runtime image omits dev dependencies");

const prometheusRules = read("deploy/prometheus/rules/automatic-agent.yml");
check("prometheus critical alerts", /severity:\s*critical/.test(prometheusRules) && /DLQ|Outbox|Latency|ErrorRate/.test(prometheusRules), "Prometheus rules include critical runtime alerts");
const alertmanager = read("deploy/prometheus/alertmanager.yml");
check("alertmanager critical route", /pagerduty-critical/.test(alertmanager) && /slack-warning/.test(alertmanager), "Alertmanager routes critical and warning alerts");

const packageJson = read("package.json");
const packageVersion = JSON.parse(packageJson).version;
check("package engines", /"engines":\s*{[\s\S]*"node":\s*">=22 <23"/.test(packageJson), "package declares Node 22 support");
check("package lock present", existsSync("package-lock.json"), "package-lock.json exists");
check("license present", existsSync("LICENSE") && /MIT License/.test(read("LICENSE")), "MIT LICENSE exists");

const chart = parseYaml(read("deploy/helm/automatic-agent/Chart.yaml"));
check(
  "chart versions align with package version",
  chart?.version === packageVersion && chart?.appVersion === packageVersion,
  `Chart.yaml version/appVersion must both equal package.json version (${packageVersion})`,
);

const releaseVersioning = read("docs_zh/operations/release-versioning.md");
check(
  "release docs track chart/package version",
  releaseVersioning.includes(`当前发布基线版本：\`${packageVersion}\``),
  "release-versioning.md records the current published baseline version",
);

const workflowFiles = readdirSync(".github/workflows").filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
const floatingActions = [];
for (const workflowFile of workflowFiles) {
  const content = read(join(".github/workflows", workflowFile));
  for (const actionRef of collectWorkflowUses(content)) {
    if (actionRef.startsWith("./")) {
      continue;
    }
    if (!isPinnedAction(actionRef)) {
      floatingActions.push(`${workflowFile}:${actionRef}`);
    }
  }
}
check(
  "all workflow actions pinned to full commit sha",
  floatingActions.length === 0,
  floatingActions.length === 0
    ? "All workflow actions are pinned to immutable commit SHAs"
    : `Unpinned refs: ${floatingActions.join(", ")}`,
);

check("supply chain docs", existsSync("docs_zh/quality/supply-chain-security.md"), "supply chain document exists");
check("license docs", existsSync("docs_zh/quality/license-compliance.md"), "license compliance document exists");
check("release versioning docs", existsSync("docs_zh/operations/release-versioning.md"), "release versioning document exists");
const contractDocs = readdirSync("docs_zh/contracts").filter((name) => name.endsWith(".md"));
check("contracts translated", contractDocs.length >= 140 && existsSync("docs_zh/contracts/README.md"), `contracts md count=${contractDocs.length}`);
check("adr 109 present", existsSync("docs_zh/adr/109-contract-freeze.md"), "ADR-109 contract freeze exists");

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`ci supply-chain audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`ci supply-chain audit passed: ${checks.length}/${checks.length}`);
