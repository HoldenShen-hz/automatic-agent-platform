/**
 * Pack Test CLI Tests
 *
 * Tests for the pack-test.ts CLI command.
 * Tests parseArgs and test result logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

interface PackTestOptions {
  manifest: string;
  verbose?: boolean;
}

function parseArgs(args: string[]): PackTestOptions {
  const opts: PackTestOptions = { manifest: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manifest" && i + 1 < args.length) opts.manifest = args[++i];
    else if (args[i] === "--verbose") opts.verbose = true;
  }
  return opts;
}

interface TestResult {
  passed: boolean;
  checks: string[];
  errors: string[];
}

// Simplified test logic extracted from pack-test.ts
function runTest(manifest: Record<string, unknown>): TestResult {
  const result: TestResult = { passed: true, checks: [], errors: [] };

  // Basic structural validation
  if (!manifest.packId || typeof manifest.packId !== "string" || !(manifest.packId as string).trim()) {
    result.passed = false;
    result.errors.push("invalid_field:packId");
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    result.passed = false;
    result.errors.push("invalid_field:version");
  }
  if (!manifest.domainId || typeof manifest.domainId !== "string" || !(manifest.domainId as string).trim()) {
    result.passed = false;
    result.errors.push("invalid_field:domainId");
  }
  if (!manifest.owner || typeof manifest.owner !== "string" || !(manifest.owner as string).trim()) {
    result.passed = false;
    result.errors.push("invalid_field:owner");
  }

  const capabilities = manifest.capabilities as Array<Record<string, unknown>> | undefined;
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
    result.passed = false;
    result.errors.push("empty_capabilities:not_allowed");
  }

  result.checks.push(`manifest_valid:true`);
  result.checks.push(`pack_id:${manifest.packId ?? ""}`);
  result.checks.push(`capabilities_count:${capabilities?.length ?? 0}`);

  const sdkRelease = manifest.sdk_release as Record<string, string> | undefined;

  // Check required fields per §22.2
  if (!sdkRelease?.sdk_semver) {
    result.passed = false;
    result.errors.push("missing_required_field:sdk_semver");
  }
  if (!sdkRelease?.platform_min_version) {
    result.passed = false;
    result.errors.push("missing_required_field:platform_min_version");
  }
  if (!sdkRelease?.platform_max_version) {
    result.passed = false;
    result.errors.push("missing_required_field:platform_max_version");
  }

  return result;
}

// Verbose version that populates additional metadata
function runTestVerbose(manifest: Record<string, unknown>): TestResult {
  const result = runTest(manifest);

  const sdkRelease = manifest.sdk_release as Record<string, string> | undefined;

  result.checks.push(`version:${manifest.version ?? "not_set"}`);
  result.checks.push(`domain:${manifest.domainId ?? "not_set"}`);
  result.checks.push(`owner:${manifest.owner ?? "not_set"}`);
  result.checks.push(`sdk_semver:${sdkRelease?.sdk_semver ?? "not_set"}`);
  result.checks.push(`platform_min_version:${sdkRelease?.platform_min_version ?? "not_set"}`);
  result.checks.push(`platform_max_version:${sdkRelease?.platform_max_version ?? "not_set"}`);
  result.checks.push(`contract_test_generator:${sdkRelease?.contract_test_generator ?? "not_set"}`);

  return result;
}

test("parseArgs extracts manifest path", () => {
  const opts = parseArgs(["--manifest", "./pack.json"]);

  assert.equal(opts.manifest, "./pack.json");
});

test("parseArgs sets verbose flag when present", () => {
  const opts = parseArgs(["--manifest", "./pack.json", "--verbose"]);

  assert.equal(opts.manifest, "./pack.json");
  assert.equal(opts.verbose, true);
});

test("parseArgs defaults verbose to undefined", () => {
  const opts = parseArgs(["--manifest", "./pack.json"]);

  assert.equal(opts.verbose, undefined);
});

test("parseArgs handles empty arguments", () => {
  const opts = parseArgs([]);

  assert.equal(opts.manifest, "");
});

test("parseArgs ignores unknown flags", () => {
  const opts = parseArgs([
    "--manifest", "./pack.json",
    "--unknown-flag", "value",
  ]);

  assert.equal(opts.manifest, "./pack.json");
});

test("runTest returns passed for a complete manifest", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: ["contract1"] },
    ],
    sdk_release: {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.checks.includes("manifest_valid:true"));
  assert.ok(result.checks.includes("pack_id:test-pack"));
  assert.ok(result.checks.includes("capabilities_count:1"));
});

test("runTest returns failed for missing packId", () => {
  const manifest = {
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_release: {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("invalid_field:packId")));
});

test("runTest returns failed for empty capabilities", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [],
    sdk_release: {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("empty_capabilities")));
});

test("runTest returns failed for missing sdk_semver", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_release: {
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("missing_required_field:sdk_semver")));
});

test("runTest returns failed for missing platform_min_version", () => {
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
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("missing_required_field:platform_min_version")));
});

test("runTest returns failed for missing platform_max_version", () => {
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
      platform_min_version: "1.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("missing_required_field:platform_max_version")));
});

test("runTest returns failed for multiple missing required fields", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.length >= 3);
  assert.ok(result.errors.some((e) => e.includes("missing_required_field:sdk_semver")));
  assert.ok(result.errors.some((e) => e.includes("missing_required_field:platform_min_version")));
  assert.ok(result.errors.some((e) => e.includes("missing_required_field:platform_max_version")));
});

test("runTestVerbose adds additional metadata checks", () => {
  const manifest = {
    packId: "test-pack",
    version: "2.0.0",
    domainId: "my-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_release: {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
      contract_test_generator: "gen-v1",
    },
  };

  const result = runTestVerbose(manifest);

  assert.equal(result.passed, true);
  assert.ok(result.checks.includes("version:2.0.0"));
  assert.ok(result.checks.includes("domain:my-domain"));
  assert.ok(result.checks.includes("owner:test-owner"));
  assert.ok(result.checks.includes("sdk_semver:1.0.0"));
  assert.ok(result.checks.includes("platform_min_version:1.0.0"));
  assert.ok(result.checks.includes("platform_max_version:2.0.0"));
  assert.ok(result.checks.includes("contract_test_generator:gen-v1"));
});

test("runTestVerbose handles missing optional fields gracefully", () => {
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
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTestVerbose(manifest);

  assert.equal(result.passed, true);
  assert.ok(result.checks.includes("contract_test_generator:not_set"));
});

test("parseArgs handles manifest path with spaces", () => {
  const opts = parseArgs(["--manifest", "./path with spaces/pack.json"]);

  assert.equal(opts.manifest, "./path with spaces/pack.json");
});

test("parseArgs handles manifest path with special characters", () => {
  const opts = parseArgs(["--manifest", "./path/with-dots_v2/pack.json"]);

  assert.equal(opts.manifest, "./path/with-dots_v2/pack.json");
});

test("runTest returns failed for whitespace-only packId", () => {
  const manifest = {
    packId: "   ",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_release: {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("invalid_field:packId")));
});

test("runTest returns failed for missing domainId", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    owner: "test-owner",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_release: {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("invalid_field:domainId")));
});

test("runTest returns failed for missing owner", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    capabilities: [
      { capabilityKey: "cap1", requiredContracts: [] },
    ],
    sdk_release: {
      sdk_semver: "1.0.0",
      platform_min_version: "1.0.0",
      platform_max_version: "2.0.0",
    },
  };

  const result = runTest(manifest);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("invalid_field:owner")));
});