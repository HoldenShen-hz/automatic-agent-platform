import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

type SeedManifest = {
  expectedGate?: string;
  seeds?: Array<{ kind?: string; path?: string }>;
};

const repoRoot = process.cwd();
const seedRoot = join(repoRoot, "tests", "fixtures", "seeded-defects");

function loadSeedManifests(): Map<string, SeedManifest> {
  const manifests = new Map<string, SeedManifest>();
  for (const entry of readdirSync(seedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = join(seedRoot, entry.name, "manifest.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SeedManifest;
    manifests.set(entry.name, manifest);
  }
  return manifests;
}

test("methodology P0 seeded-defect families stay backed by executable manifests", () => {
  const manifests = loadSeedManifests();
  const requiredFamilies = [
    ["tenant-query-missing", "audit:tenant-isolation"],
    ["secret-logged", "audit-secret-sinks"],
    ["idempotency-missing-key", "audit-idempotency"],
    ["eval-oracle", "audit-eval-oracle"],
    ["plugin-security", "audit-plugin-security"],
    ["release-claims", "audit-release-claims"],
    ["contracts-sync", "audit-contracts-sync"],
    ["execution-invariants", "audit-execution-invariants"],
    ["path-safety", "audit-path-safety"],
    ["architecture-boundary", "audit-architecture-boundary"],
    ["auth-role-mapping", "audit-auth-role-mapping"],
    ["docs-sot", "audit-docs-sot"],
    ["fire-and-forget", "audit-fire-and-forget"],
    ["ui-token-storage", "audit-ui-token-storage"],
    ["redteam", "audit-redteam"],
    ["golden", "audit-golden"],
    ["dataset", "audit-dataset"],
    ["test-disabled", "audit-test-disabled"],
    ["test-coverage", "scripts/assurance/verify-test-coverage.mjs"],
  ] as const;

  for (const [dirName, expectedGate] of requiredFamilies) {
    const manifest = manifests.get(dirName);
    assert.ok(manifest, `missing manifest for seeded family ${dirName}`);
    assert.equal(
      manifest.expectedGate,
      expectedGate,
      `seeded family ${dirName} drifted from its expected gate`,
    );
    const seedKinds = new Set((manifest.seeds ?? []).map((seed) => seed.kind));
    assert.ok(seedKinds.has("positive"), `${dirName} must keep a positive seed`);
    assert.ok(seedKinds.has("negative"), `${dirName} must keep a negative seed`);
    assert.ok(seedKinds.has("evasion"), `${dirName} must keep an evasion seed`);
  }
});
