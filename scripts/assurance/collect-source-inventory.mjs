#!/usr/bin/env node
/**
 * Assurance Layer 1: source inventory
 *
 * Walks the repo and emits a structured inventory of code / tests / docs /
 * contracts / config / workflows / schemas. Per
 * docs_zh/contracts/assurance-pipeline-contract.md §2.
 *
 * Outputs (under artifacts/assurance/):
 *   - source-inventory.json
 *   - routes.json
 *   - contracts.json
 *   - events.json
 *   - tests.json
 *   - docs-index.json
 *   - config-index.json
 *   - workflows-index.json
 *
 * Usage:
 *   node scripts/assurance/collect-source-inventory.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");
const scriptPath = fileURLToPath(import.meta.url);

const SCAN_EXTS = new Set([
  ".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx",
  ".md", ".mdx", ".json", ".yaml", ".yml", ".toml",
]);
const SKIP_DIRS = new Set([
  "node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache",
]);
const TOKEN_STOP_WORDS = new Set([
  "src", "docs", "tests", "test", "platform", "index", "service", "module", "root",
  "json", "yaml", "yml", "md", "mjs", "mts", "ts", "tsx", "js", "jsx", "config",
  "default", "runtime", "shared", "core", "apps", "file",
]);
const OWNER_BY_PLANE = {
  "five-plane-interface": "platform-architect",
  "five-plane-control-plane": "platform-architect",
  "five-plane-orchestration": "execution-reviewer",
  "five-plane-execution": "execution-reviewer",
  "five-plane-state-evidence": "evidence-reviewer",
  "domains": "domain-reviewer",
  "interaction": "ui-reviewer",
  "org-governance": "security-reviewer",
  "scale-ecosystem": "ops-reviewer",
  "ops-maturity": "ops-reviewer",
  "sdk": "ops-reviewer",
  "plugins": "security-reviewer",
  "scripts": "ops-reviewer",
  "ui": "ui-reviewer",
  "config": "ops-reviewer",
  ".github": "ops-reviewer",
  "root": "release-owner",
};

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (stat.isFile() && SCAN_EXTS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function pathSegmentsAfter(rel, prefix) {
  return rel.slice(prefix.length).split("/").filter((segment) => segment.length > 0);
}

export function classify(rel) {
  if (rel.startsWith("src/platform/")) {
    const segments = pathSegmentsAfter(rel, "src/platform/");
    return {
      kind: "code",
      plane: segments[0] ?? "unknown",
      module: segments.slice(1, -1).join("/") || "root",
    };
  }
  if (rel.startsWith("src/domains/")) return { kind: "code", plane: "domains", module: pathSegmentsAfter(rel, "src/domains/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/interaction/")) return { kind: "code", plane: "interaction", module: pathSegmentsAfter(rel, "src/interaction/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/org-governance/")) return { kind: "code", plane: "org-governance", module: pathSegmentsAfter(rel, "src/org-governance/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/scale-ecosystem/")) return { kind: "code", plane: "scale-ecosystem", module: pathSegmentsAfter(rel, "src/scale-ecosystem/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/ops-maturity/")) return { kind: "code", plane: "ops-maturity", module: pathSegmentsAfter(rel, "src/ops-maturity/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/core/")) return { kind: "code", plane: "core", module: pathSegmentsAfter(rel, "src/core/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/runtime/")) return { kind: "code", plane: "runtime", module: pathSegmentsAfter(rel, "src/runtime/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/sdk/")) return { kind: "code", plane: "sdk", module: pathSegmentsAfter(rel, "src/sdk/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/plugins/")) return { kind: "code", plane: "plugins", module: pathSegmentsAfter(rel, "src/plugins/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("src/shared/")) return { kind: "code", plane: "shared", module: pathSegmentsAfter(rel, "src/shared/").slice(0, -1).join("/") || "root" };
  if (rel.startsWith("tests/")) return { kind: "test", plane: "tests", module: pathSegmentsAfter(rel, "tests/")[0] ?? "root" };
  if (rel.startsWith("docs_zh/contracts/")) return { kind: "contract", plane: "docs_zh", module: basename(rel) };
  if (rel.startsWith("docs_zh/")) return { kind: "doc", plane: "docs_zh", module: pathSegmentsAfter(rel, "docs_zh/")[0] ?? "root" };
  if (rel.startsWith("docs_en/")) return { kind: "doc", plane: "docs_en", module: pathSegmentsAfter(rel, "docs_en/")[0] ?? "root" };
  if (rel.startsWith("ui/")) return { kind: "ui", plane: "ui", module: pathSegmentsAfter(rel, "ui/")[0] ?? "root" };
  if (rel.startsWith("scripts/")) return { kind: "script", plane: "scripts", module: pathSegmentsAfter(rel, "scripts/")[0] ?? "root" };
  if (rel.startsWith("schemas/")) return { kind: "schema", plane: "schemas", module: basename(rel) };
  if (rel.startsWith("config/")) return { kind: "config", plane: "config", module: pathSegmentsAfter(rel, "config/")[0] ?? "root" };
  if (rel.startsWith("eval/")) return { kind: "dataset", plane: "eval", module: pathSegmentsAfter(rel, "eval/")[0] ?? "root" };
  if (rel.startsWith("redteam/")) return { kind: "dataset", plane: "redteam", module: pathSegmentsAfter(rel, "redteam/")[0] ?? "root" };
  if (rel.startsWith("roi/")) return { kind: "config", plane: "roi", module: pathSegmentsAfter(rel, "roi/")[0] ?? "root" };
  if (rel.startsWith("training-data-policy/")) return { kind: "config", plane: "training-data-policy", module: pathSegmentsAfter(rel, "training-data-policy/")[0] ?? "root" };
  if (rel.startsWith(".github/")) return { kind: "workflow", plane: ".github", module: pathSegmentsAfter(rel, ".github/")[0] ?? "root" };
  if (rel === "package.json" || rel === "tsconfig.json") return { kind: "config", plane: "root", module: rel };
  if (rel === "README.md" || rel === "AGENTS.md" || rel === "MEMORY.md" || rel === "CONTRIBUTING.md") {
    return { kind: "doc", plane: "root", module: rel };
  }
  return { kind: "other", plane: "other", module: "" };
}

export function deriveDocTags(rel, text) {
  const tags = [];
  if (rel.startsWith("docs_zh/reviews/") || rel.startsWith("docs_en/reviews/")) {
    tags.push("review_source");
    if (/\b(issue|issues|问题|缺口|review table|baseline verification|cleanup)\b/i.test(text)) {
      tags.push("issue_source");
    }
    if (/\b(done|accepted|final|release-ready|production-ready|industry-leading|已完成|可发布|行业领先)\b/i.test(text)) {
      tags.push("claim_source");
    }
    if (/\b(verification|验证|baseline|cleanup|revalidate|复核)\b/i.test(text)) {
      tags.push("verification_source");
    }
    tags.push("historical_snapshot");
  }
  return [...new Set(tags)];
}

export function inferRiskTags(rel, text = "") {
  const haystack = `${rel}\n${text}`.toLowerCase();
  const tags = new Set();
  const add = (tag, pattern) => {
    if (pattern.test(haystack)) {
      tags.add(tag);
    }
  };

  add("tenant", /\btenant|workspace|namespace|residency|cross-tenant\b/);
  add("secret", /\bsecret|credential|token storage|api key|webhook secret\b/);
  add("auth", /\bauth|rbac|approval|sso|scim|takeover\b/);
  add("release", /\brelease|rollout|canary|promotion|evidence bundle|rc:check\b/);
  add("execution", /\bexecution|dispatch|worker|runtime|queue|lease|fencing|recovery\b/);
  add("state_evidence", /\baudit|receipt|event outbox|evidence|projection\b/);
  add("path_safety", /\bpath|sandbox|symlink|workspace root|filesystem\b/);
  add("plugin", /\bplugin|adapter|retriever|presenter|validator\b/);
  add("dataset", /\beval|redteam|golden|fixture|dataset\b/);
  add("ci", /\bci|workflow|github actions|baseline\b/);
  add("ui_operator", /\bconsole|dashboard|operator|websocket|sharedworker\b/);

  if (rel.startsWith("docs_zh/reviews/") || rel.startsWith("docs_en/reviews/")) {
    tags.add("review");
  }
  if (rel.startsWith("docs_zh/releases/") || rel.startsWith("docs_zh/reference/") || rel.startsWith("docs_en/reference/")) {
    tags.add("claim");
  }
  if (rel.startsWith("tests/fixtures/seeded-defects/")) {
    tags.add("seeded_defect");
  }

  return [...tags].sort();
}

export function inferOwner(rel, classification, riskTags = []) {
  if (riskTags.includes("secret") || riskTags.includes("auth") || riskTags.includes("tenant")) {
    return "security-reviewer";
  }
  if (riskTags.includes("release") || rel.startsWith("docs_zh/releases/")) {
    return "release-owner";
  }
  return OWNER_BY_PLANE[classification.plane] ?? "TBD";
}

function normalizeTokens(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 3 && !TOKEN_STOP_WORDS.has(token));
}

function buildModuleKey(entry) {
  return `${entry.kind}:${entry.plane}:${entry.module || "root"}`;
}

function collectModuleTokens(entry) {
  const tokens = new Set([
    ...normalizeTokens(entry.path),
    ...normalizeTokens(entry.plane),
    ...normalizeTokens(entry.module),
  ]);
  return [...tokens];
}

function matchSupportingPaths(moduleTokens, candidatePaths, limit = 25) {
  const matches = [];
  const tokenSet = new Set(moduleTokens);
  for (const candidatePath of candidatePaths) {
    const candidateTokens = normalizeTokens(candidatePath);
    if (candidateTokens.some((token) => tokenSet.has(token))) {
      matches.push(candidatePath);
    }
    if (matches.length >= limit) {
      break;
    }
  }
  return matches;
}

function inferCiGates(riskTags, kind) {
  const gates = new Set(["ci:baseline"]);
  if (kind === "code" || kind === "ui" || kind === "script") {
    gates.add("assurance:full");
  }
  if (riskTags.includes("tenant")) gates.add("audit:tenant-isolation");
  if (riskTags.includes("secret")) gates.add("audit:secret-sinks");
  if (riskTags.includes("plugin")) gates.add("audit:plugin-security");
  if (riskTags.includes("path_safety")) gates.add("audit:path-safety");
  if (riskTags.includes("claim") || riskTags.includes("release")) gates.add("audit:release-claims");
  if (riskTags.includes("dataset")) {
    gates.add("audit:eval-oracle");
    gates.add("test:seeded-defects");
  }
  if (riskTags.includes("execution")) {
    gates.add("test:invariants");
  }
  return [...gates].sort();
}

export function buildModuleOwnershipRecords(entries) {
  const moduleMap = new Map();
  const testPaths = entries.filter((entry) => entry.kind === "test").map((entry) => entry.path);
  const contractPaths = entries
    .filter((entry) => entry.kind === "contract" || entry.path.startsWith("docs_zh/contracts/"))
    .map((entry) => entry.path);

  for (const entry of entries) {
    if (!["code", "ui", "script", "config", "workflow"].includes(entry.kind)) {
      continue;
    }
    const key = buildModuleKey(entry);
    const existing = moduleMap.get(key) ?? {
      moduleId: key,
      kind: entry.kind,
      plane: entry.plane,
      module: entry.module || "root",
      owner: entry.owner,
      fileCount: 0,
      files: [],
      riskTags: new Set(),
      supportingTests: [],
      supportingContracts: [],
      ciGates: [],
      hasTests: false,
      hasContract: false,
    };
    existing.fileCount += 1;
    existing.files.push(entry.path);
    for (const tag of entry.riskTags ?? []) {
      existing.riskTags.add(tag);
    }
    moduleMap.set(key, existing);
  }

  const modules = [];
  for (const record of moduleMap.values()) {
    const moduleTokens = [
      ...new Set(record.files.flatMap((path) => normalizeTokens(path)).concat(normalizeTokens(record.module))),
    ];
    const supportingTests = matchSupportingPaths(moduleTokens, testPaths);
    const supportingContracts = matchSupportingPaths(moduleTokens, contractPaths);
    const riskTags = [...record.riskTags].sort();
    modules.push({
      moduleId: record.moduleId,
      kind: record.kind,
      plane: record.plane,
      module: record.module,
      owner: record.owner,
      fileCount: record.fileCount,
      files: record.files.sort(),
      riskTags,
      hasTests: supportingTests.length > 0,
      supportingTests,
      hasContract: supportingContracts.length > 0,
      supportingContracts,
      ciGates: inferCiGates(riskTags, record.kind),
    });
  }

  return modules.sort((left, right) => left.moduleId.localeCompare(right.moduleId));
}

export function detectRoutes(text) {
  const routes = [];
  const re = /(?:app|router|fastify|hono)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return routes;
}

export function detectEventNames(text) {
  const events = [];
  const re = /(?:event|topic|channel|stream)\s*[:=]\s*['"`]([a-zA-Z0-9_.\-]+)['"`]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    events.push(m[1]);
  }
  return events;
}

export function detectContractNames(text) {
  const names = [];
  const re = /\b(export\s+)?(interface|type|class)\s+([A-Z][A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[3].length > 2) names.push(m[3]);
  }
  return names;
}

export function detectMetricNames(text) {
  const metrics = [];
  const patterns = [
    /\b(?:counter|histogram|gauge|summary)\s*\(\s*["'`]([a-zA-Z0-9_.:-]+)["'`]/g,
    /\bname\s*:\s*["'`]([a-zA-Z0-9_.:-]+)["'`]\s*,?\s*(?:type\s*:\s*["'`](?:counter|histogram|gauge|summary)|help\s*:)/g,
    /\b(?:metric|meter|telemetry)[A-Za-z0-9_]*\s*[:=]\s*["'`]([a-zA-Z0-9_.:-]+)["'`]/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      metrics.push(match[1]);
    }
  }
  return metrics;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });

  const allFiles = walk(repoRoot);
  const inventory = [];
  const routes = [];
  const contracts = [];
  const events = [];
  const metrics = [];
  const tests = [];
  const docs = [];
  const configs = [];
  const workflows = [];
  const packageScripts = readFileSync(join(repoRoot, "package.json"), "utf8");
  const parsedPackage = JSON.parse(packageScripts);

  for (const file of allFiles) {
    const rel = relative(repoRoot, file);
    const cls = classify(rel);
    let text = null;
    if (cls.kind === "doc" || cls.kind === "code" || cls.kind === "ui" || cls.kind === "script") {
      try {
        text = readFileSync(file, "utf8");
      } catch {
        text = null;
      }
    }
    const riskTags = inferRiskTags(rel, text ?? "");
    const owner = inferOwner(rel, cls, riskTags);
    inventory.push({
      path: rel,
      ...cls,
      tags: cls.kind === "doc" && text != null ? deriveDocTags(rel, text) : [],
      owner,
      riskTags,
    });
    if (cls.kind === "code" && /route|controller|router|gateway|endpoint/i.test(rel)) {
      try {
        const sourceText = text ?? readFileSync(file, "utf8");
        for (const route of detectRoutes(sourceText)) {
          routes.push({ ...route, sourceFile: rel });
        }
      } catch {
        // ignore unreadable
      }
    }
    if (cls.kind === "code" && /event|topic|stream|message/i.test(rel)) {
      try {
        const sourceText = text ?? readFileSync(file, "utf8");
        for (const name of detectEventNames(sourceText)) {
          events.push({ name, sourceFile: rel });
        }
      } catch {
        // ignore
      }
    }
    if (cls.kind === "code" && /contracts?|schema/.test(rel)) {
      try {
        const sourceText = text ?? readFileSync(file, "utf8");
        for (const name of detectContractNames(sourceText)) {
          contracts.push({ name, sourceFile: rel });
        }
      } catch {
        // ignore
      }
    }
    if ((cls.kind === "code" || cls.kind === "ui") && /metric|telemetry|observability|prometheus|alert/i.test(rel)) {
      try {
        const sourceText = text ?? readFileSync(file, "utf8");
        for (const name of detectMetricNames(sourceText)) {
          metrics.push({ name, sourceFile: rel });
        }
      } catch {
        // ignore
      }
    }
    if (cls.kind === "test") tests.push({ path: rel });
    if (cls.kind === "doc") docs.push({ path: rel });
    if (cls.kind === "config") configs.push({ path: rel });
    if (cls.kind === "workflow") workflows.push({ path: rel });
  }

  const moduleOwnership = buildModuleOwnershipRecords(inventory);
  const moduleById = new Map(moduleOwnership.map((record) => [record.moduleId, record]));
  const enrichedInventory = inventory.map((entry) => {
    const moduleRecord = moduleById.get(buildModuleKey(entry));
    return {
      ...entry,
      hasTests: moduleRecord?.hasTests ?? false,
      hasContract: moduleRecord?.hasContract ?? false,
      ciGates: moduleRecord?.ciGates ?? inferCiGates(entry.riskTags ?? [], entry.kind),
    };
  });

  // Write outputs
  const stamp = new Date().toISOString();
  const byKind = enrichedInventory.reduce((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});
  const sourceInventoryPayload = {
    generatedAt: stamp,
    totalFiles: enrichedInventory.length,
    moduleCount: moduleOwnership.length,
    byKind,
    files: enrichedInventory,
    modules: moduleOwnership,
  };
  const routesPayload = { generatedAt: stamp, routeCount: routes.length, routes };
  const contractsPayload = { generatedAt: stamp, contractCount: contracts.length, contracts };
  const eventsPayload = { generatedAt: stamp, eventCount: events.length, events };
  const metricsPayload = { generatedAt: stamp, metricCount: metrics.length, metrics };
  const testsPayload = { generatedAt: stamp, testCount: tests.length, tests };
  const docsPayload = { generatedAt: stamp, docCount: docs.length, docs };
  const configPayload = { generatedAt: stamp, configCount: configs.length, configs };
  const workflowsPayload = { generatedAt: stamp, workflowCount: workflows.length, workflows };
  const baselineDir = join(outputRoot, "baseline");

  writeFileSync(join(outputRoot, "source-inventory.json"), JSON.stringify({
    ...sourceInventoryPayload,
  }, null, 2));
  writeFileSync(join(outputRoot, "routes.json"), JSON.stringify(routesPayload, null, 2));
  writeFileSync(join(outputRoot, "contracts.json"), JSON.stringify(contractsPayload, null, 2));
  writeFileSync(join(outputRoot, "events.json"), JSON.stringify(eventsPayload, null, 2));
  writeFileSync(join(outputRoot, "metrics.json"), JSON.stringify(metricsPayload, null, 2));
  writeFileSync(join(outputRoot, "tests.json"), JSON.stringify(testsPayload, null, 2));
  writeFileSync(join(outputRoot, "docs-index.json"), JSON.stringify(docsPayload, null, 2));
  writeFileSync(join(outputRoot, "config-index.json"), JSON.stringify(configPayload, null, 2));
  writeFileSync(join(outputRoot, "workflows-index.json"), JSON.stringify(workflowsPayload, null, 2));

  mkdirSync(baselineDir, { recursive: true });
  writeFileSync(join(baselineDir, "repo-file-index.json"), JSON.stringify(sourceInventoryPayload, null, 2));
  writeFileSync(join(baselineDir, "package-scripts.json"), JSON.stringify({
    generatedAt: stamp,
    scriptCount: Object.keys(parsedPackage.scripts ?? {}).length,
    scripts: parsedPackage.scripts ?? {},
  }, null, 2));
  writeFileSync(join(baselineDir, "routes.json"), JSON.stringify(routesPayload, null, 2));
  writeFileSync(join(baselineDir, "contracts.json"), JSON.stringify(contractsPayload, null, 2));
  writeFileSync(join(baselineDir, "events.json"), JSON.stringify(eventsPayload, null, 2));
  writeFileSync(join(baselineDir, "metrics.json"), JSON.stringify(metricsPayload, null, 2));
  writeFileSync(join(baselineDir, "tests.json"), JSON.stringify(testsPayload, null, 2));

  const summary = {
    generatedAt: stamp,
    totalFiles: enrichedInventory.length,
    moduleCount: moduleOwnership.length,
    byKind,
    routeCount: routes.length,
    contractCount: contracts.length,
    eventCount: events.length,
    metricCount: metrics.length,
    testCount: tests.length,
    docCount: docs.length,
    configCount: configs.length,
    workflowCount: workflows.length,
    outputDir: "artifacts/assurance/",
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] != null && resolve(process.argv[1]).replaceAll("\\", "/") === scriptPath.replaceAll("\\", "/")) {
  main();
}
