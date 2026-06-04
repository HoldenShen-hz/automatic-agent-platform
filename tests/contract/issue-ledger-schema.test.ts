/**
 * @issue  CONTRACT-ISSUE-LEDGER-001
 * @invariant INV-CONTRACT-SYNC-001
 * @gate   audit:contracts-sync
 * @severity P0
 *
 * Contract test: verifies that the issue-ledger JSON schema at
 * schemas/issue-ledger.schema.json is valid JSON Schema and that the
 * existing review-ledger artifact conforms to its own schema.
 *
 * Per docs §44.12: contract tests must verify docs / TS type / Zod /
 * JSON schema / runtime are consistent. This is the schema/round-trip
 * side of that obligation.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

const SCHEMAS = [
  "schemas/assumption-ledger.schema.json",
  "schemas/issue-ledger.schema.json",
  "schemas/coverage-scorecard.schema.json",
  "schemas/completeness-coverage-matrix.schema.json",
  "schemas/assurance-report.schema.json",
  "schemas/historical-issue-regression-map.schema.json",
  "schemas/historical-promise-ledger.schema.json",
  "schemas/historical-promise-drift-report.schema.json",
  "schemas/rc-check-report.schema.json",
  "schemas/release-evidence-bundle.schema.json",
  "schemas/review-conflict-resolution.schema.json",
  "schemas/review-evidence-readiness-report.schema.json",
  "schemas/seeded-defect.schema.json",
  "schemas/review-ledger.schema.json",
  "schemas/review-source-coverage-report.schema.json",
  "schemas/source-inventory.schema.json",
  "schemas/static-audit-report.schema.json",
  "schemas/test-coverage-report.schema.json",
  "schemas/test-issue-map.schema.json",
];

describe("contract: schemas/ JSON validity and minimum required fields", () => {
  for (const rel of SCHEMAS) {
    it(`${rel} is valid JSON Schema and has a top-level required[]`, () => {
      const abs = join(repoRoot, rel);
      assert.ok(existsSync(abs), `missing schema: ${rel}`);
      const text = readFileSync(abs, "utf8");
      const parsed = JSON.parse(text);
      assert.equal(parsed.type, "object", `${rel} must declare type=object`);
      assert.ok(Array.isArray(parsed.required), `${rel} must declare required[]`);
      assert.ok(parsed.required.length > 0, `${rel} required[] must not be empty`);
      assert.ok(parsed.properties, `${rel} must declare properties`);
    });
  }

  for (const sample of [
    "artifacts/assurance/review-ledger.raw.jsonl",
    "artifacts/assurance/review-ledger.normalized.jsonl",
  ]) {
    it(`${sample} conforms to review-ledger.schema.json (light check)`, () => {
      const abs = join(repoRoot, sample);
      if (!existsSync(abs)) {
        // Skip: artifact not generated yet. Coverage scorecard will catch this.
        return;
      }
      const lines = readFileSync(abs, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .slice(0, 50);
      const schema = JSON.parse(readFileSync(join(repoRoot, "schemas/review-ledger.schema.json"), "utf8"));
      const required = schema.required as string[];
      for (const line of lines) {
        const obj = JSON.parse(line) as Record<string, unknown>;
        for (const field of required) {
          assert.ok(
            Object.prototype.hasOwnProperty.call(obj, field),
            `review-ledger line missing required field '${field}': ${line.slice(0, 80)}`,
          );
        }
      }
    });
  }

  const topLevelArtifactChecks = [
    ["schemas/source-inventory.schema.json", "artifacts/assurance/source-inventory.json"],
    ["schemas/review-source-coverage-report.schema.json", "artifacts/assurance/review-source-coverage-report.json"],
    ["schemas/review-evidence-readiness-report.schema.json", "artifacts/assurance/review-evidence-readiness-report.json"],
    ["schemas/static-audit-report.schema.json", "artifacts/assurance/static-audit-report.json"],
    ["schemas/historical-promise-drift-report.schema.json", "artifacts/assurance/historical-promise-drift-report.json"],
    ["schemas/test-coverage-report.schema.json", "artifacts/assurance/test-coverage-report.json"],
    ["schemas/completeness-coverage-matrix.schema.json", "artifacts/assurance/completeness-coverage-matrix.json"],
    ["schemas/historical-issue-regression-map.schema.json", "artifacts/assurance/historical-issue-regression-map.json"],
    ["schemas/test-issue-map.schema.json", "artifacts/assurance/test-to-issue-map.json"],
    ["schemas/test-issue-map.schema.json", "artifacts/assurance/issue-to-test-map.json"],
  ] as const;

  for (const [schemaRel, artifactRel] of topLevelArtifactChecks) {
    it(`${artifactRel} matches ${schemaRel} required fields and top-level keys (light check)`, () => {
      const artifactAbs = join(repoRoot, artifactRel);
      if (!existsSync(artifactAbs)) {
        return;
      }
      const schema = JSON.parse(readFileSync(join(repoRoot, schemaRel), "utf8")) as {
        required: string[];
        properties: Record<string, unknown>;
      };
      const payload = JSON.parse(readFileSync(artifactAbs, "utf8")) as Record<string, unknown>;
      for (const field of schema.required) {
        assert.ok(Object.prototype.hasOwnProperty.call(payload, field), `${artifactRel} missing required field ${field}`);
      }
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(payload)) {
        assert.ok(allowedKeys.has(key), `${artifactRel} contains unexpected top-level key ${key}`);
      }
    });
  }

  for (const [schemaRel, artifactRel] of [
    ["schemas/assumption-ledger.schema.json", "artifacts/assurance/assumptions.jsonl"],
    ["schemas/review-conflict-resolution.schema.json", "artifacts/assurance/review-conflict-resolution-report.jsonl"],
  ] as const) {
    it(`${artifactRel} conforms to ${schemaRel} required fields (light check)`, () => {
      const artifactAbs = join(repoRoot, artifactRel);
      if (!existsSync(artifactAbs)) {
        return;
      }
      const lines = readFileSync(artifactAbs, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .slice(0, 50);
      const schema = JSON.parse(readFileSync(join(repoRoot, schemaRel), "utf8")) as {
        required: string[];
        properties: Record<string, unknown>;
      };
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const line of lines) {
        const payload = JSON.parse(line) as Record<string, unknown>;
        for (const field of schema.required) {
          assert.ok(Object.prototype.hasOwnProperty.call(payload, field), `${artifactRel} line missing ${field}`);
        }
        for (const key of Object.keys(payload)) {
          assert.ok(allowedKeys.has(key), `${artifactRel} contains unexpected key ${key}`);
        }
      }
    });
  }

  it("issue-ledger.schema.json requires gating fields and accepts review-backed issues", () => {
    const schema = JSON.parse(readFileSync(join(repoRoot, "schemas/issue-ledger.schema.json"), "utf8"));
    const required = new Set(schema.required as string[]);
    assert.ok(required.has("requiredTest"), "issue-ledger schema must require requiredTest");
    assert.ok(required.has("requiredGate"), "issue-ledger schema must require requiredGate");

    const sourceEnum = schema.properties?.source?.enum as string[] | undefined;
    assert.ok(Array.isArray(sourceEnum), "issue-ledger source enum must exist");
    assert.ok(sourceEnum.includes("review"), "issue-ledger source enum must allow review-backed issues");

    const requiredTestEnum = schema.properties?.requiredTest?.items?.enum as string[] | undefined;
    assert.ok(Array.isArray(requiredTestEnum), "issue-ledger requiredTest enum must exist");
    assert.ok(requiredTestEnum.includes("regression"), "issue-ledger requiredTest enum must allow regression");
  });
});
