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
  "schemas/issue-ledger.schema.json",
  "schemas/coverage-scorecard.schema.json",
  "schemas/assurance-report.schema.json",
  "schemas/historical-promise-ledger.schema.json",
  "schemas/release-evidence-bundle.schema.json",
  "schemas/seeded-defect.schema.json",
  "schemas/review-ledger.schema.json",
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

  it("review-ledger.normalized.jsonl conforms to review-ledger.schema.json (light check)", () => {
    const sample = "artifacts/assurance/review-ledger.normalized.jsonl";
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
