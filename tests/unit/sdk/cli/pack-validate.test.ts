/**
 * Pack Validate CLI Tests
 *
 * Tests for the pack-validate.ts CLI command.
 * Tests parseArgs and validation logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

interface PackValidateOptions {
  manifest: string;
  contractVersion?: string;
  strict?: boolean;
}

function parseArgs(args: string[]): PackValidateOptions {
  const opts: PackValidateOptions = { manifest: "", strict: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--manifest" && typeof next === "string") {
      opts.manifest = next;
      i += 1;
    } else if (arg === "--contract-version" && typeof next === "string") {
      opts.contractVersion = next;
      i += 1;
    } else if (arg === "--strict") {
      opts.strict = true;
    }
  }
  return opts;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Record<string, string>;
}

function parseMajorVersion(version: string): number {
  const [majorSegment] = version.trim().split(".");
  const major = Number(majorSegment);
  return Number.isFinite(major) ? major : 0;
}

// Simplified validation logic extracted from pack-validate.ts for testing
function runValidation(manifest: Record<string, unknown>, opts: PackValidateOptions): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [], metadata: {} };

  // Basic structural validation
  if (!manifest.packId || typeof manifest.packId !== "string" || !manifest.packId.trim()) {
    result.valid = false;
    result.errors.push("invalid_field:packId");
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    result.valid = false;
    result.errors.push("invalid_field:version");
  }
  if (!manifest.domainId || typeof manifest.domainId !== "string" || !manifest.domainId.trim()) {
    result.valid = false;
    result.errors.push("invalid_field:domainId");
  }
  if (!manifest.owner || typeof manifest.owner !== "string" || !manifest.owner.trim()) {
    result.valid = false;
    result.errors.push("invalid_field:owner");
  }

  const capabilities = manifest.capabilities as Array<Record<string, unknown>> | undefined;
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
    result.valid = false;
    result.errors.push("empty_capabilities:not_allowed");
  }

  result.metadata["pack_id"] = (manifest.packId as string) || "";
  result.metadata["version"] = (manifest.version as string) || "";
  result.metadata["capabilities"] = String(capabilities?.length ?? 0);

  // Contract version validation
  if (opts.contractVersion) {
    const minVersion = (manifest.platform_min_version as string | undefined) ?? "0.0.0";
    const maxVersion = (manifest.platform_max_version as string | undefined) ?? "999.999.999";
    const contractMajor = parseMajorVersion(opts.contractVersion);
    const minMajor = parseMajorVersion(minVersion);
    const maxMajor = parseMajorVersion(maxVersion);

    if (contractMajor < minMajor || contractMajor > maxMajor) {
      result.valid = false;
      result.errors.push(`contract_version_mismatch:requested=${opts.contractVersion},supported=${minVersion}-${maxVersion}`);
    } else {
      result.warnings.push(`contract_version_ok:${opts.contractVersion}`);
    }
  }

  // Required compatibility metadata check
  if (!manifest.sdk_semver) {
    result.valid = false;
    result.errors.push("missing_field:sdk_semver");
  }
  if (!manifest.platform_min_version) {
    result.valid = false;
    result.errors.push("missing_field:platform_min_version");
  }
  if (!manifest.platform_max_version) {
    result.valid = false;
    result.errors.push("missing_field:platform_max_version");
  }

  // Contract test generator check
  if (!manifest.contract_test_generator) {
    result.warnings.push("missing_optional_field:contract_test_generator");
  }

  // Capability validation
  if (capabilities && capabilities.length > 0) {
    for (const cap of capabilities) {
      if (!cap.capabilityKey || typeof cap.capabilityKey !== "string" || !cap.capabilityKey.trim()) {
        result.valid = false;
        result.errors.push("invalid_capability:capabilityKey_empty");
      }
      const requiredContracts = cap.requiredContracts as string[] | undefined;
      if (!requiredContracts || requiredContracts.length === 0) {
        result.warnings.push(`capability_requires_no_contracts:${cap.capabilityKey}`);
      }
    }
  }

  return result;
}

test("parseArgs extracts manifest path", () => {
  const opts = parseArgs(["--manifest", "./pack.json"]);

  assert.equal(opts.manifest, "./pack.json");
});

test("parseArgs extracts contract-version", () => {
  const opts = parseArgs(["--manifest", "./pack.json", "--contract-version", "1.0.0"]);

  assert.equal(opts.manifest, "./pack.json");
  assert.equal(opts.contractVersion, "1.0.0");
});

test("parseArgs sets strict flag when present", () => {
  const opts = parseArgs(["--manifest", "./pack.json", "--strict"]);

  assert.equal(opts.manifest, "./pack.json");
  assert.equal(opts.strict, true);
});

test("parseArgs defaults strict to false", () => {
  const opts = parseArgs(["--manifest", "./pack.json"]);

  assert.equal(opts.strict, false);
});

test("parseArgs handles empty arguments", () => {
  const opts = parseArgs([]);

  assert.equal(opts.manifest, "");
  assert.equal(opts.contractVersion, undefined);
  assert.equal(opts.strict, false);
});

test("parseArgs ignores unknown flags", () => {
  const opts = parseArgs([
    "--manifest", "./pack.json",
    "--unknown-flag", "value",
  ]);

  assert.equal(opts.manifest, "./pack.json");
});

test("runValidation returns valid for a complete manifest", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: ["contract1"] },
    ],
    sdk_semver: "1.0.0",
    platform_min_version: "1.0.0",
    platform_max_version: "2.0.0",
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("runValidation returns invalid for missing packId", () => {
  const manifest = {
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("invalid_field:packId")));
});

test("runValidation returns invalid for empty capabilities", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("empty_capabilities")));
});

test("runValidation uses requested contract version instead of manifest minimum version", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: ["contract1"] },
    ],
    sdk_semver: "1.0.0",
    platform_min_version: "2.0.0",
    platform_max_version: "3.0.0",
  };

  const ok = runValidation(manifest, { manifest: "./pack.json", contractVersion: "2.5.0" });
  const mismatch = runValidation(manifest, { manifest: "./pack.json", contractVersion: "1.5.0" });

  assert.equal(ok.valid, true);
  assert.ok(ok.warnings.includes("contract_version_ok:2.5.0"));
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.some((entry) => entry.includes("requested=1.5.0")));
});

test("runValidation fails for missing compatibility metadata by default", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("missing_field:sdk_semver")));
  assert.ok(result.errors.some((e) => e.includes("missing_field:platform_min_version")));
  assert.ok(result.errors.some((e) => e.includes("missing_field:platform_max_version")));
});

test("runValidation still fails for missing compatibility metadata in strict mode", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json", strict: true };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("missing_field:sdk_semver")));
  assert.ok(result.errors.some((e) => e.includes("missing_field:platform_min_version")));
  assert.ok(result.errors.some((e) => e.includes("missing_field:platform_max_version")));
});

test("runValidation adds warning for missing contract_test_generator", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_release: {
      sdk_semver: "1.0.0",
    },
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.ok(result.warnings.some((w) => w.includes("missing_optional_field:contract_test_generator")));
});

test("runValidation validates contract version compatibility", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_semver: "1.0.0",
    platform_min_version: "2.0.0",
    platform_max_version: "3.0.0",
  };

  const opts: PackValidateOptions = { manifest: "./pack.json", contractVersion: "1.0.0" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("contract_version_mismatch")));
});

test("runValidation accepts compatible contract version", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_semver: "1.0.0",
    platform_min_version: "2.0.0",
    platform_max_version: "3.0.0",
  };

  const opts: PackValidateOptions = { manifest: "./pack.json", contractVersion: "2.0.0" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes("contract_version_ok")));
});

test("runValidation adds warning for capability with no required contracts", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.ok(result.warnings.some((w) => w.includes("capability_requires_no_contracts")));
});

test("runValidation returns invalid for empty capabilityKey", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "", requiredContracts: [] },
    ],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("invalid_capability:capabilityKey_empty")));
});

test("runValidation returns invalid for whitespace-only capabilityKey", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "   ", requiredContracts: [] },
    ],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("invalid_capability:capabilityKey_empty")));
});

test("runValidation sets correct metadata", () => {
  const manifest = {
    packId: "test-pack",
    version: "2.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
      { capabilityKey: "cap2", requiredContracts: [] },
    ],
  };

  const opts: PackValidateOptions = { manifest: "./pack.json" };
  const result = runValidation(manifest, opts);

  assert.equal(result.metadata["pack_id"], "test-pack");
  assert.equal(result.metadata["version"], "2.0.0");
  assert.equal(result.metadata["capabilities"], "2");
});

test("runValidation handles manifest with multiple capabilities", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: ["contract1"] },
      { capabilityKey: "cap2", requiredContracts: ["contract2", "contract3"] },
    ],
    sdk_semver: "1.0.0",
    platform_min_version: "1.0.0",
    platform_max_version: "5.0.0",
  };

  const opts: PackValidateOptions = { manifest: "./pack.json", contractVersion: "3.0.0" };
  const result = runValidation(manifest, opts);

  assert.equal(result.valid, true);
  assert.equal(result.metadata["capabilities"], "2");
});

test("parseArgs handles manifest path with special characters", () => {
  const opts = parseArgs(["--manifest", "./path/with spaces/pack.json"]);

  assert.equal(opts.manifest, "./path/with spaces/pack.json");
});
