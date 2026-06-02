import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

const checks = [];
const EXIT_CODE_FAILURE = 1;
const EXIT_CODE_MISSING_INPUT = 2;
const RELEASE_BASELINE_VERSION_MARKER = /ReleaseBaselineVersion:\s*`([^`]+)`/u;

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`supply_chain.read_failed:${path}:${message}`);
  }
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function readDir(path) {
  try {
    return readdirSync(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`supply_chain.read_dir_failed:${path}:${message}`);
  }
}

function parseJsonDocument(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`supply_chain.parse_json_failed:${path}:${message}`);
  }
}

function parseYamlDocument(path) {
  try {
    return parseYaml(read(path));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`supply_chain.parse_yaml_failed:${path}:${message}`);
  }
}

function collectWorkflowUses(content) {
  const matches = [];
  const usesPattern = /^\s*uses:\s*([^\s#]+)\s*$/gm;
  for (const match of content.matchAll(usesPattern)) {
    matches.push(match[1]);
  }
  return matches;
}

function workflowHasPersistCredentialsDisabled(content) {
  const lines = content.split(/\r?\n/u);
  const checkoutIndexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*uses:\s*actions\/checkout@/u.test(lines[index])) {
      checkoutIndexes.push(index);
    }
  }

  return checkoutIndexes.every((checkoutIndex) => {
    const checkoutIndent = lines[checkoutIndex].match(/^(\s*)/u)?.[1].length ?? 0;
    let sawWith = false;
    for (let index = checkoutIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      const indent = line.match(/^(\s*)/u)?.[1].length ?? 0;
      if (line.trim().length === 0) {
        continue;
      }
      if (indent <= checkoutIndent && !/^\s*with:/u.test(line)) {
        break;
      }
      if (/^\s*with:\s*$/u.test(line)) {
        sawWith = true;
        continue;
      }
      if (sawWith && /^\s*persist-credentials:\s*false\s*$/u.test(line)) {
        return true;
      }
      if (sawWith && indent <= checkoutIndent) {
        break;
      }
    }
    return false;
  });
}

function isPinnedAction(ref) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?@[0-9a-f]{40}$/u.test(ref);
}

function main() {
const ci = read(".github/workflows/ci.yml");
check(
  "ci top-level permissions are read-only",
  /permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*read/u.test(ci) && !/^permissions:[\s\S]*security-events:\s*write/m.test(ci.split("jobs:")[0] ?? ""),
  "CI keeps top-level permissions read-only and scopes security-events to SARIF jobs",
);
check("ci concurrency", /concurrency:[\s\S]*cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*!=\s*'schedule'\s*\}\}/.test(ci), "CI cancels superseded runs except for scheduled sweeps");
check("ci npm ci ignores scripts", /run:\s*npm ci --ignore-scripts/.test(ci), "CI installs from lockfile without lifecycle script execution");
check("ci npm audit sarif pipeline", /npm audit --audit-level=high --omit=dev --json/.test(ci) && /upload-sarif@[0-9a-f]{40}/.test(ci), "CI converts npm audit findings into SARIF and uploads them");
check("ci typecheck", /npm run typecheck/.test(ci), "CI runs typecheck");
check("ci coverage gate", /npm run coverage:gate/.test(ci), "CI runs coverage gate");
check("ci codeql", /github\/codeql-action\/analyze@[0-9a-f]{40}/.test(ci), "CI runs CodeQL");
check(
  "ci docker build excluded from pull_request",
  /Build Docker image for downstream security scan[\s\S]*if:\s*github\.event_name != 'pull_request'/u.test(ci),
  "CI only builds untrusted Dockerfiles on trusted events",
);
check(
  "ci trivy",
  /aquasecurity\/trivy-action@[0-9a-f]{40}/.test(ci)
    && /IMAGE_REPOSITORY:\s*automatic-agent-platform/.test(ci)
    && /image-ref:\s*\$\{\{\s*env\.IMAGE_REGISTRY\s*\}\}\/\$\{\{\s*env\.IMAGE_REPOSITORY\s*\}\}:\$\{\{\s*env\.IMAGE_TAG\s*\}\}/.test(ci)
    && /CRITICAL,HIGH/.test(ci),
  "CI scans the same fully-qualified image naming surface used for release promotion",
);

const publish = read(".github/workflows/publish-image.yml");
check(
  "publish least privilege permissions",
  /^permissions:\s*\n\s*contents:\s*read/m.test(publish)
    && /publish:\s*\n\s*permissions:\s*\n\s*contents:\s*read\s*\n\s*packages:\s*write\s*\n\s*id-token:\s*write/u.test(publish),
  "publish keeps package/OIDC write access on the publish job only",
);
check("publish environment approval", /environment:\s*\$\{\{/.test(publish), "publish job binds GitHub environment");
check("publish buildx action", /docker\/build-push-action@[0-9a-f]{40}/.test(publish), "publish uses Buildx build-push action");
check(
  "publish gha cache is isolated",
  /cache-from:\s*type=gha,scope=publish-image/.test(publish) && /cache-to:\s*type=gha,scope=publish-image,mode=(?:max|min)/.test(publish),
  "publish uses a workflow-specific GitHub Actions Docker cache scope",
);
check("publish sha tag", /type=sha,prefix=sha-/.test(publish), "publish emits sha tag");
check(
  "publish explicit image tag",
  /type=raw,value=\$\{\{\s*(inputs\.image_tag|needs\.preflight\.outputs\.image_tag)\s*\}\}/.test(publish),
  "publish uses an explicit validated image tag",
);
check(
  "publish repository prefix gate",
  /IMAGE_REPOSITORY_PREFIX="automatic-agent-platform"/.test(publish)
    && /\[\[\s*"\$IMAGE_REPOSITORY"\s*=~\s*\^\$\{IMAGE_REPOSITORY_PREFIX\}/.test(publish),
  "publish validates image repositories against the automatic-agent-platform prefix",
);

const dockerfile = read("Dockerfile");
check("docker runtime non-root", /USER node/.test(dockerfile), "runtime container uses node user");
check("docker healthcheck", /HEALTHCHECK/.test(dockerfile), "Dockerfile declares healthcheck");
check(
  "docker dependency install is non-root and ignores scripts",
  /USER node/.test(dockerfile) && /RUN npm ci --ignore-scripts/.test(dockerfile),
  "Docker dependency stages run npm as node and disable lifecycle scripts",
);
check(
  "docker runtime reuses pruned dependencies",
  /FROM deps AS runtime-deps/.test(dockerfile)
    && /npm prune --omit=dev/.test(dockerfile)
    && /COPY --from=runtime-deps(?: --chown=node:node)? \/app\/node_modules \.\/node_modules/.test(dockerfile)
    && !/npm ci --omit=dev/.test(dockerfile),
  "Docker runtime copies pruned dependencies instead of reinstalling them",
);
check(
  "docker tini bootstrap is checksum pinned",
  /ARG TINI_VERSION="v0\.19\.0"/.test(dockerfile)
    && /TINI_SHA256/.test(dockerfile)
    && /https:\/\/github\.com\/krallin\/tini\/releases\/download/.test(dockerfile),
  "Dockerfile installs tini from a pinned release with checksum verification",
);

const prometheusRules = read("deploy/prometheus/rules/automatic-agent.yml");
check("prometheus critical alerts", /severity:\s*critical/.test(prometheusRules) && /DLQ|Outbox|Latency|ErrorRate/.test(prometheusRules), "Prometheus rules include critical runtime alerts");
const alertmanager = read("deploy/prometheus/alertmanager.yml");
check("alertmanager critical route", /pagerduty-critical/.test(alertmanager) && /slack-warning/.test(alertmanager), "Alertmanager routes critical and warning alerts");

const packageJson = read("package.json");
const packageVersion = parseJsonDocument("package.json").version;
check("package engines", /"engines":\s*{[\s\S]*"node":\s*">=22 <23"/.test(packageJson), "package declares Node 22 support");
check("package lock present", existsSync("package-lock.json"), "package-lock.json exists");
check("license present", existsSync("LICENSE") && /MIT License/.test(read("LICENSE")), "MIT LICENSE exists");

const chart = parseYamlDocument("deploy/helm/automatic-agent/Chart.yaml");
check(
  "chart versions align with package version",
  chart?.version === packageVersion && chart?.appVersion === packageVersion,
  `Chart.yaml version/appVersion must both equal package.json version (${packageVersion})`,
);

const releaseVersioning = read("docs_zh/operations/release-versioning.md");
const releaseBaselineVersion = releaseVersioning.match(RELEASE_BASELINE_VERSION_MARKER)?.[1] ?? null;
check(
  "release docs track chart/package version",
  releaseBaselineVersion === packageVersion,
  `release-versioning.md machine marker must equal package.json version (${packageVersion})`,
);

const workflowFiles = readDir(".github/workflows").filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
const floatingActions = [];
const checkoutCredentialLeaks = [];
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
  if (!workflowHasPersistCredentialsDisabled(content)) {
    checkoutCredentialLeaks.push(workflowFile);
  }
}
check(
  "all workflow actions pinned to full commit sha",
  floatingActions.length === 0,
  floatingActions.length === 0
    ? "All workflow actions are pinned to immutable commit SHAs"
    : `Unpinned refs: ${floatingActions.join(", ")}`,
);
check(
  "all workflow checkouts disable persisted credentials",
  checkoutCredentialLeaks.length === 0,
  checkoutCredentialLeaks.length === 0
    ? "All workflow checkout steps disable persisted GitHub credentials"
    : `Missing persist-credentials=false in: ${checkoutCredentialLeaks.join(", ")}`,
);

check("supply chain docs", existsSync("docs_zh/quality/supply-chain-security.md"), "supply chain document exists");
const actionsAllowlist = existsSync("docs_zh/quality/actions-allowlist.md") ? read("docs_zh/quality/actions-allowlist.md") : "";
check(
  "third-party action allowlist exists",
  /treosh\/lighthouse-ci-action/u.test(actionsAllowlist)
    && /512cc908a55bfb0ad231facca52adf3d3a651df4/u.test(actionsAllowlist),
  "actions allowlist documents approved third-party actions including Lighthouse",
);
check("license docs", existsSync("docs_zh/quality/license-compliance.md"), "license compliance document exists");
check("release versioning docs", existsSync("docs_zh/operations/release-versioning.md"), "release versioning document exists");
const contractDocs = readDir("docs_zh/contracts").filter((name) => name.endsWith(".md"));
check("contracts translated", contractDocs.length >= 140 && existsSync("docs_zh/contracts/README.md"), `contracts md count=${contractDocs.length}`);
check("adr 109 present", existsSync("docs_zh/adr/109-contract-freeze.md"), "ADR-109 contract freeze exists");

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`ci supply-chain audit failed: ${failures.length}/${checks.length}`);
  process.exit(EXIT_CODE_FAILURE);
}

console.log(`ci supply-chain audit passed: ${checks.length}/${checks.length}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (/^supply_chain\.(read|read_dir|parse_json|parse_yaml)_failed:/u.test(message)) {
    process.exit(EXIT_CODE_MISSING_INPUT);
  }
  process.exit(EXIT_CODE_FAILURE);
}
