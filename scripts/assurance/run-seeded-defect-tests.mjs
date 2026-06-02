#!/usr/bin/env node
/**
 * Assurance Layer 8: seeded defect runner
 *
 * Iterates tests/fixtures/seeded-defects/<category>/manifest.json and runs the
 * associated audit:* gate against the positive/negative/evasion seeds,
 * verifying that:
 *   - positive seeds ARE caught
 *   - negative seeds are NOT caught
 *   - evasion seeds ARE caught
 *
 * Per docs_zh/contracts/assurance-pipeline-contract.md §6.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const seedDir = join(repoRoot, "tests", "fixtures", "seeded-defects");
const outputRoot = join(repoRoot, "artifacts", "assurance");

function runAudit(scriptName, focusPath) {
  try {
    const out = execFileSync("node", [`scripts/ci/${scriptName}.mjs`, "--path", focusPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return { ok: true, report: JSON.parse(out) };
  } catch (e) {
    return { ok: false, status: e.status ?? 1, error: String(e) };
  }
}

function readManifest(dir) {
  const path = join(dir, "manifest.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function resolveGateMode(expectedGate) {
  if (typeof expectedGate !== "string" || expectedGate.length === 0) {
    return { kind: "skip", reason: "manifest missing expectedGate" };
  }
  if (expectedGate.startsWith("audit-")) {
    return { kind: "audit-script", value: expectedGate };
  }
  if (expectedGate.startsWith("audit:")) {
    return { kind: "audit-script", value: expectedGate.replace("audit:", "audit-") };
  }
  if (expectedGate.startsWith("scripts/")) {
    return {
      kind: "skip",
      reason:
        "non-generic script gate is covered by its dedicated node test, not by the generic seeded-defect runner",
    };
  }
  return {
    kind: "skip",
    reason: `unsupported gate form for generic seeded-defect runner: ${expectedGate}`,
  };
}

function evaluateCategory(categoryDir) {
  const manifest = readManifest(categoryDir);
  if (!manifest) {
    return { category: categoryDir, skipped: true, reason: "no manifest.json" };
  }
  const gateMode = resolveGateMode(manifest.expectedGate);
  const gate = gateMode.kind === "audit-script" ? gateMode.value : manifest.expectedGate;
  if (gateMode.kind === "skip") {
    return {
      category: categoryDir,
      manifest: manifest.fixtureId,
      gate,
      expectedResult: manifest.expectedResult,
      skipped: true,
      reason: gateMode.reason,
      seeds: [],
    };
  }
  const seeds = manifest.seeds ?? [];
  const result = { category: categoryDir, manifest: manifest.fixtureId, gate, expectedResult: manifest.expectedResult, seeds: [] };
  for (const seed of seeds) {
    const r = runAudit(gate, seed.path);
    const findings = r.ok ? (r.report?.findings ?? []) : [];
    const inThisFile = findings.filter((f) => f.path.endsWith(seed.path.split("/").pop() ?? ""));
    const blocking = inThisFile.filter((f) => f.severity === "P0" || f.severity === "P1");
    let pass = false;
    if (seed.kind === "positive" || seed.kind === "evasion") {
      pass = blocking.length > 0;
    } else if (seed.kind === "negative") {
      pass = blocking.length === 0;
    }
    result.seeds.push({
      kind: seed.kind,
      path: seed.path,
      findings: inThisFile.length,
      blockingFindings: blocking.length,
      pass,
    });
  }
  return result;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();
  if (!existsSync(seedDir)) {
    process.stdout.write(`${JSON.stringify({ generatedAt: stamp, status: "fail", reason: `seeded-defects directory missing: ${seedDir}` }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  const categories = readdirSync(seedDir).filter((d) => {
    try { return existsSync(join(seedDir, d, "manifest.json")); } catch { return false; }
  });
  // Skip categories whose audit script is path-restricted in a way
  // that prevents per-seed scanning. The contracts-sync audit, for
  // example, scans ALL P0 contracts globally and reports missing
  // layers regardless of the input path. Its negative seed is
  // therefore meaningless; we still scan positive/evasion but skip
  // the negative one.
  const PATH_RESTRICTED_GATES = new Set(["audit-contracts-sync"]);

  const results = [];
  for (const c of categories) {
    const evald = evaluateCategory(join(seedDir, c));
    if (PATH_RESTRICTED_GATES.has(evald.gate) && evald.seeds) {
      evald.seeds = evald.seeds.filter((s) => s.kind !== "negative");
      evald.skipped = ["negative (audit is global, not per-seed)"];
    }
    results.push(evald);
  }
  const failed = results.flatMap((r) => (r.seeds ?? []).filter((s) => !s.pass));

  const report = {
    generatedAt: stamp,
    categoryCount: results.length,
    seedCount: results.flatMap((r) => r.seeds ?? []).length,
    failedSeedCount: failed.length,
    results,
    status: failed.length === 0 ? "pass" : "fail",
  };
  writeFileSync(join(outputRoot, "seeded-defect-report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status === "fail") {
    process.exitCode = 1;
  }
}

main();
