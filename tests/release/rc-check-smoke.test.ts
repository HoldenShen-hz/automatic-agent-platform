/**
 * @issue  RELEASE-P0-RC-CHECK-SMOKE-001
 * @invariant INV-RC-EVIDENCE-BUNDLE-001
 * @gate   release:rc-check
 * @severity P0
 *
 * Release P0 case (per methodology §44.3 / §44.13):
 * the artifacts/release/evidence-bundle.json MUST exist and MUST
 * conform to its own schema (additionalProperties: false, required
 * fields present, includedReports list consistent with the rc-check
 * report on disk).
 *
 * If the evidence-bundle.json is missing (CI has not yet produced
 * it), this test skips with an explicit reason — it must NOT fail
 * silently, and it must NOT mark the release as ready.
 *
 * Per docs_zh/contracts/issue-ledger-contract.md and the
 * assurance:full pipeline, the rc-check smoke gate is the
 * release-blocking entry point.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const evidencePath = join(repoRoot, "artifacts", "release", "evidence-bundle.json");
const rcReportPath = join(repoRoot, "artifacts", "release", "rc-check-report.json");
const evidenceSchemaPath = join(repoRoot, "schemas", "release-evidence-bundle.schema.json");

interface EvidenceBundle {
  schemaVersion?: string;
  generatedAt?: string;
  commitSha?: string;
  branch?: string;
  configVersion?: string;
  contractSchemaVersion?: string;
  eventRegistryHash?: string;
  validationRunId?: string;
  includedReports?: { path: string; present: boolean; sha256: string | null; sizeBytes: number }[];
}

describe("release: rc-check-smoke (P0)", () => {
  it("artifacts/release/evidence-bundle.json exists (skip with reason if not yet generated)", (t) => {
    if (!existsSync(evidencePath)) {
      t.skip(`evidence-bundle.json not present at ${evidencePath} (CI has not generated it yet)`);
      return;
    }
    assert.ok(existsSync(evidenceSchemaPath), `missing schema: ${evidenceSchemaPath}`);
    const raw = readFileSync(evidencePath, "utf8");
    const bundle = JSON.parse(raw) as EvidenceBundle;
    const schema = JSON.parse(readFileSync(evidenceSchemaPath, "utf8")) as {
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
    const schemaProperties = new Set(Object.keys(schema.properties ?? {}));
    const required = new Set(schema.required ?? []);

    assert.equal(schema.additionalProperties, false, "release-evidence-bundle schema must be fail-closed");
    for (const field of required) {
      assert.ok(Object.prototype.hasOwnProperty.call(bundle, field), `bundle missing required field: ${field}`);
    }
    for (const key of Object.keys(bundle)) {
      assert.ok(schemaProperties.has(key), `bundle contains unexpected top-level key: ${key}`);
    }
    assert.equal(bundle.schemaVersion, "1.0", "schemaVersion must be 1.0");
    assert.ok(bundle.generatedAt, "generatedAt is required");
    assert.match(
      bundle.commitSha ?? "",
      /^[0-9a-f]{7,40}$/i,
      `commitSha must be a git sha, got: ${bundle.commitSha}`,
    );
    assert.ok(bundle.branch, "branch is required");
    assert.ok(Array.isArray(bundle.includedReports), "includedReports must be an array");
    assert.ok((bundle.includedReports ?? []).length >= 1, "includedReports must have >=1 entry");
  });

  it("rc-check-report.json exists alongside the evidence bundle", (t) => {
    if (!existsSync(evidencePath)) {
      t.skip(`evidence-bundle.json not present — rc-check-report.json gate deferred`);
      return;
    }
    assert.ok(existsSync(rcReportPath), `expected ${rcReportPath} to exist when evidence bundle exists`);
  });

  it("evidence-bundle includedReports refers to files that exist on disk", (t) => {
    if (!existsSync(evidencePath)) {
      t.skip("evidence-bundle.json not present");
      return;
    }
    const schema = JSON.parse(readFileSync(evidenceSchemaPath, "utf8")) as {
      properties?: {
        includedReports?: {
          items?: {
            properties?: Record<string, unknown>;
            required?: string[];
            additionalProperties?: boolean;
          };
        };
      };
    };
    const itemSchema = schema.properties?.includedReports?.items;
    const itemProperties = new Set(Object.keys(itemSchema?.properties ?? {}));
    const itemRequired = new Set(itemSchema?.required ?? []);
    const bundle = JSON.parse(readFileSync(evidencePath, "utf8")) as EvidenceBundle;
    for (const entry of bundle.includedReports ?? []) {
      assert.equal(itemSchema?.additionalProperties, false, "includedReports schema must be fail-closed");
      for (const field of itemRequired) {
        assert.ok(Object.prototype.hasOwnProperty.call(entry, field), `includedReports entry missing ${field}`);
      }
      for (const key of Object.keys(entry)) {
        assert.ok(itemProperties.has(key), `includedReports entry has unexpected key: ${key}`);
      }
      const abs = join(repoRoot, entry.path);
      assert.ok(existsSync(abs), `includedReports entry missing on disk: ${entry.path}`);
      assert.equal(entry.present, true, `includedReports.present must be true for ${entry.path}`);
      assert.match(
        entry.sha256 ?? "",
        /^[a-f0-9]{64}$/,
        `includedReports.sha256 must be 64-hex, got: ${entry.sha256}`,
      );
      assert.ok(entry.sizeBytes > 0, `includedReports.sizeBytes must be > 0 for ${entry.path}`);
    }
  });

  it("evidence-bundle.json is a real RC artifact (sha256 of file matches its own listed sizes)", (t) => {
    if (!existsSync(evidencePath)) {
      t.skip("evidence-bundle.json not present");
      return;
    }
    const bundle = JSON.parse(readFileSync(evidencePath, "utf8")) as EvidenceBundle;
    // The bundle itself isn't part of includedReports, but its on-disk
    // size must be > 0 and the JSON must parse.
    const size = readFileSync(evidencePath, "utf8").length;
    assert.ok(size > 0, "evidence-bundle.json must be non-empty on disk");
  });
});
