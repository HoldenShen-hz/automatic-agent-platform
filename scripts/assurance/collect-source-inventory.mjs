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

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");

const SCAN_EXTS = new Set([
  ".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx",
  ".md", ".mdx", ".json", ".yaml", ".yml", ".toml",
]);
const SKIP_DIRS = new Set([
  "node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache",
]);

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

function classify(rel) {
  if (rel.startsWith("src/platform/")) {
    const plane = rel.split("/")[3] ?? "unknown";
    return { kind: "code", plane, module: rel.split("/").slice(4, -1).join("/") || "root" };
  }
  if (rel.startsWith("src/domains/")) return { kind: "code", plane: "domains", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/interaction/")) return { kind: "code", plane: "interaction", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/org-governance/")) return { kind: "code", plane: "org-governance", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/scale-ecosystem/")) return { kind: "code", plane: "scale-ecosystem", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/ops-maturity/")) return { kind: "code", plane: "ops-maturity", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/core/")) return { kind: "code", plane: "core", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/runtime/")) return { kind: "code", plane: "runtime", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/sdk/")) return { kind: "code", plane: "sdk", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/plugins/")) return { kind: "code", plane: "plugins", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("src/shared/")) return { kind: "code", plane: "shared", module: rel.split("/")[3] ?? "" };
  if (rel.startsWith("tests/")) return { kind: "test", plane: "tests", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("docs_zh/contracts/")) return { kind: "contract", plane: "docs_zh", module: basename(rel) };
  if (rel.startsWith("docs_zh/")) return { kind: "doc", plane: "docs_zh", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("docs_en/")) return { kind: "doc", plane: "docs_en", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("ui/")) return { kind: "ui", plane: "ui", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("scripts/")) return { kind: "script", plane: "scripts", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("schemas/")) return { kind: "schema", plane: "schemas", module: basename(rel) };
  if (rel.startsWith("config/")) return { kind: "config", plane: "config", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("eval/")) return { kind: "dataset", plane: "eval", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("redteam/")) return { kind: "dataset", plane: "redteam", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("roi/")) return { kind: "config", plane: "roi", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith("training-data-policy/")) return { kind: "config", plane: "training-data-policy", module: rel.split("/")[1] ?? "" };
  if (rel.startsWith(".github/")) return { kind: "workflow", plane: ".github", module: rel.split("/")[1] ?? "" };
  if (rel === "package.json" || rel === "tsconfig.json") return { kind: "config", plane: "root", module: rel };
  if (rel === "README.md" || rel === "AGENTS.md" || rel === "MEMORY.md" || rel === "CONTRIBUTING.md") {
    return { kind: "doc", plane: "root", module: rel };
  }
  return { kind: "other", plane: "other", module: "" };
}

function deriveDocTags(rel, text) {
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

function detectRoutes(text) {
  const routes = [];
  const re = /(?:app|router|fastify|hono)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return routes;
}

function detectEventNames(text) {
  const events = [];
  const re = /(?:event|topic|channel|stream)\s*[:=]\s*['"`]([a-zA-Z0-9_.\-]+)['"`]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    events.push(m[1]);
  }
  return events;
}

function detectContractNames(text) {
  const names = [];
  const re = /\b(export\s+)?(interface|type|class)\s+([A-Z][A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[3].length > 2) names.push(m[3]);
  }
  return names;
}

function detectMetricNames(text) {
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
    inventory.push({
      path: rel,
      ...cls,
      tags: cls.kind === "doc" && text != null ? deriveDocTags(rel, text) : [],
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

  // Write outputs
  const stamp = new Date().toISOString();
  const byKind = inventory.reduce((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});
  const sourceInventoryPayload = {
    generatedAt: stamp,
    totalFiles: inventory.length,
    byKind,
    files: inventory,
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
    totalFiles: inventory.length,
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

main();
