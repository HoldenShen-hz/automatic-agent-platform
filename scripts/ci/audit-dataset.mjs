#!/usr/bin/env node
/**
 * Audit: dataset card (§12.2)
 *
 * For every `dataset-card.json` the platform uses to gate eval runs, this
 * scanner enforces the §12.2 contract:
 *
 *   - dataset-card.json MUST exist per dataset
 *   - samples path declared on the card MUST resolve on disk
 *   - frozenHash MUST be a real sha256 (NOT a placeholder
 *     `sha256:<datasetId>`), so that a tamper would actually change it
 *   - contaminationStatus MUST carry a non-empty `evidence` array
 *   - retentionPolicyRef MUST be a non-empty string
 *   - the schema in eval/schemas/eval-dataset-card.schema.json MUST have
 *     `additionalProperties: false`
 *   - sampleCount MUST exist and be > 0
 *
 * Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §12.2 and §44.13.2.
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : ".";
})();

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  "artifacts",
  "build",
  ".tmp",
  ".test-db",
  ".cache",
]);

const SCHEMA_PATH = "eval/schemas/eval-dataset-card.schema.json";
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const PLACEHOLDER_HASH_PATTERN = /^sha256:<.+>$/;

const FINDING_RULES = {
  DATASET_CARD_MISSING_SAMPLES_PATH: "dataset.samples_path_missing",
  DATASET_CARD_SAMPLES_PATH_NOT_ON_DISK: "dataset.samples_path_unresolved",
  DATASET_CARD_FROZEN_HASH_PLACEHOLDER: "dataset.frozen_hash_placeholder",
  DATASET_CARD_FROZEN_HASH_INVALID: "dataset.frozen_hash_invalid",
  DATASET_CARD_CONTAMINATION_EVIDENCE_EMPTY: "dataset.contamination_evidence_empty",
  DATASET_CARD_RETENTION_POLICY_MISSING: "dataset.retention_policy_missing",
  DATASET_CARD_SCHEMA_NOT_STRICT: "dataset.schema_not_strict",
  DATASET_CARD_SAMPLE_COUNT_MISSING: "dataset.sample_count_missing",
  DATASET_CARD_SAMPLE_COUNT_NON_POSITIVE: "dataset.sample_count_non_positive",
};

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function isDatasetCardCandidate(path) {
  const base = basename(path);
  return base === "dataset-card.json" || base === "dataset-card.yaml" || base === "dataset-card.yml";
}

function safeParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function checkSchemaStrict() {
  if (!existsSync(SCHEMA_PATH)) {
    return [
      {
        rule: FINDING_RULES.DATASET_CARD_SCHEMA_NOT_STRICT,
        severity: "P0",
        path: SCHEMA_PATH,
        line: 1,
        message: `Required dataset-card schema is missing at ${SCHEMA_PATH}.`,
      },
    ];
  }
  let schema;
  try {
    schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  } catch (e) {
    return [
      {
        rule: FINDING_RULES.DATASET_CARD_SCHEMA_NOT_STRICT,
        severity: "P0",
        path: SCHEMA_PATH,
        line: 1,
        message: `Dataset-card schema at ${SCHEMA_PATH} is not valid JSON.`,
      },
    ];
  }
  const findings = [];
  if (schema.additionalProperties !== false) {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_SCHEMA_NOT_STRICT,
      severity: "P0",
      path: SCHEMA_PATH,
      line: 1,
      message: `eval-dataset-card.schema.json MUST set "additionalProperties": false (currently ${
        JSON.stringify(schema.additionalProperties ?? null)
      }).`,
    });
  }
  return findings;
}

function findingsForCard(cardPath, card) {
  const rel = relative(repoRoot, cardPath);
  const findings = [];
  const datasetId = typeof card?.datasetId === "string" ? card.datasetId : "<missing-datasetId>";

  // samples path
  const samples = card?.samples;
  if (samples == null) {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_MISSING_SAMPLES_PATH,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} is missing the "samples" path field.`,
    });
  } else if (typeof samples !== "string" || samples.trim() === "") {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_MISSING_SAMPLES_PATH,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} has a non-string "samples" field.`,
    });
  } else {
    const abs = resolve(repoRoot, samples);
    if (!existsSync(abs)) {
      findings.push({
        rule: FINDING_RULES.DATASET_CARD_SAMPLES_PATH_NOT_ON_DISK,
        severity: "P0",
        path: rel,
        line: 1,
        message: `Dataset card ${datasetId} declares samples path "${samples}" but the file/dir does not exist on disk.`,
      });
    }
  }

  // frozenHash
  const frozenHash = card?.frozenHash;
  if (typeof frozenHash !== "string" || frozenHash.trim() === "") {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_FROZEN_HASH_INVALID,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} is missing "frozenHash".`,
    });
  } else if (PLACEHOLDER_HASH_PATTERN.test(frozenHash)) {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_FROZEN_HASH_PLACEHOLDER,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} has placeholder frozenHash "${frozenHash}". Replace with the real sha256 of the sample payload.`,
    });
  } else if (!SHA256_PATTERN.test(frozenHash)) {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_FROZEN_HASH_INVALID,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} has frozenHash "${frozenHash}" which is not sha256:<64 hex>.`,
    });
  }

  // contaminationStatus.evidence
  const contamination = card?.contaminationStatus;
  if (typeof contamination === "string") {
    // Backwards-compatible with the existing schema (string enum).
    // We still require an evidence array somewhere on the card.
    const evidence = card?.contaminationEvidence ?? card?.contaminationStatusEvidence;
    if (!Array.isArray(evidence) || evidence.length === 0) {
      findings.push({
        rule: FINDING_RULES.DATASET_CARD_CONTAMINATION_EVIDENCE_EMPTY,
        severity: "P0",
        path: rel,
        line: 1,
        message: `Dataset card ${datasetId} has contaminationStatus="${contamination}" but no non-empty "contaminationStatus.evidence" (or "contaminationEvidence") array.`,
      });
    }
  } else if (contamination && typeof contamination === "object") {
    const evidence = contamination.evidence;
    if (!Array.isArray(evidence) || evidence.length === 0) {
      findings.push({
        rule: FINDING_RULES.DATASET_CARD_CONTAMINATION_EVIDENCE_EMPTY,
        severity: "P0",
        path: rel,
        line: 1,
        message: `Dataset card ${datasetId} has contaminationStatus object but no non-empty "evidence" array.`,
      });
    }
  } else {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_CONTAMINATION_EVIDENCE_EMPTY,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} has no "contaminationStatus" field.`,
    });
  }

  // retentionPolicyRef
  const retention = card?.retentionPolicyRef;
  if (typeof retention !== "string" || retention.trim() === "") {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_RETENTION_POLICY_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} is missing a non-empty "retentionPolicyRef".`,
    });
  }

  // sampleCount
  const sampleCount = card?.sampleCount;
  if (sampleCount == null) {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_SAMPLE_COUNT_MISSING,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} is missing the "sampleCount" field.`,
    });
  } else if (typeof sampleCount !== "number" || !Number.isFinite(sampleCount) || sampleCount <= 0) {
    findings.push({
      rule: FINDING_RULES.DATASET_CARD_SAMPLE_COUNT_NON_POSITIVE,
      severity: "P0",
      path: rel,
      line: 1,
      message: `Dataset card ${datasetId} has sampleCount=${JSON.stringify(sampleCount)} (must be a finite number > 0).`,
    });
  }

  return findings;
}

function main() {
  const focusAbs = resolve(repoRoot, focusPath);
  let stat;
  try {
    stat = statSync(focusAbs);
  } catch {
    console.error(JSON.stringify({ error: `path not found: ${focusPath}` }));
    process.exitCode = 2;
    return;
  }
  const findings = [];
  findings.push(...checkSchemaStrict());
  const targets = stat.isDirectory() ? walk(focusAbs) : [focusAbs];
  for (const file of targets) {
    if (extname(file) !== ".json") continue;
    if (!isDatasetCardCandidate(file)) continue;
    const text = readFileSync(file, "utf8");
    const parsed = safeParseJson(text);
    if (!parsed.ok) {
      findings.push({
        rule: FINDING_RULES.DATASET_CARD_SAMPLE_COUNT_MISSING,
        severity: "P0",
        path: relative(repoRoot, file),
        line: 1,
        message: `Dataset card is not valid JSON: ${parsed.error}`,
      });
      continue;
    }
    findings.push(...findingsForCard(file, parsed.value));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: targets.filter(isDatasetCardCandidate).length,
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {}),
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.some((f) => f.severity === "P0")) {
    process.exitCode = 1;
  }
}

main();
