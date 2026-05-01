/**
 * @fileoverview Unit tests for Pack Scaffold Service
 *
 * Tests the PackScaffoldService for generating Pack project structure from template.
 * Implements §22.2 Pack SDK core capability: `scaffold(config)`.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  PackScaffoldService,
  type ScaffoldConfig,
  type PackTemplate,
} from "../../../src/sdk/pack-sdk/pack-scaffold-service.js";

// Use temp directory for scaffold tests to avoid polluting the repo
const TEST_PACKS_DIR = "/tmp/test-packs-scaffold-service";

test.beforeEach(() => {
  // Ensure test directory exists
  mkdirSync(TEST_PACKS_DIR, { recursive: true });
});

test.afterEach(() => {
  // Clean up test directory
  try {
    rmSync(TEST_PACKS_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

test("PackScaffoldService.listTemplates returns all template options", () => {
  const service = new PackScaffoldService();
  const templates = service.listTemplates();

  assert.equal(templates.length, 3);
  assert.ok(templates.find((t) => t.id === "minimal"));
  assert.ok(templates.find((t) => t.id === "standard"));
  assert.ok(templates.find((t) => t.id === "full"));
});

test("PackScaffoldService.listTemplates provides descriptions", () => {
  const service = new PackScaffoldService();
  const templates = service.listTemplates();

  const minimal = templates.find((t) => t.id === "minimal");
  assert.ok(minimal?.description.includes("Single tool"));

  const standard = templates.find((t) => t.id === "standard");
  assert.ok(standard?.description.includes("Multiple tools"));
});

test("PackScaffoldService.scaffold validates empty packId", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack ID is required/,
  );
});

test("PackScaffoldService.scaffold validates whitespace-only packId", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "   ",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack ID is required/,
  );
});

test("PackScaffoldService.scaffold validates packId format (lowercase required)", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "TestPack", // uppercase not allowed
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack ID must match pattern/,
  );
});

test("PackScaffoldService.scaffold validates empty name", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack name is required/,
  );
});

test("PackScaffoldService.scaffold validates name with injection characters", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test${bad}",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /contains invalid characters/,
  );
});

test("PackScaffoldService.scaffold validates name with backticks", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test`name",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /contains invalid characters/,
  );
});

test("PackScaffoldService.scaffold validates name with newlines", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test\nName",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /cannot contain newlines/,
  );
});

test("PackScaffoldService.scaffold validates empty owner", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack owner is required/,
  );
});

test("PackScaffoldService.scaffold validates domain with injection characters", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test${domain}",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /contains invalid characters/,
  );
});

test("PackScaffoldService.scaffold validates domain with newlines", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test\ndomain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /cannot contain newlines/,
  );
});

test("PackScaffoldService.scaffold generates minimal template structure", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);

  assert.ok(result.rootDir.includes("test-pack"));
  assert.ok(result.files.length >= 4); // package.json, src/index.ts, src/tools/query-tool.ts, tests/unit.test.ts, manifest.json
  assert.ok(result.manifestPath.endsWith("manifest.json"));
  assert.ok(result.entryPointPath.endsWith("src/index.ts"));
});

test("PackScaffoldService.scaffold generates standard template structure", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "standard",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "medium",
  };

  const result = service.scaffold(config);

  // Standard template has more files: package.json, src/index.ts, src/tools/query-tool.ts,
  // src/tools/transform-tool.ts, src/adapters/http-adapter.ts, src/evaluators/result-evaluator.ts,
  // tests/unit.test.ts, tests/integration.test.ts, manifest.json
  assert.ok(result.files.length >= 9);
});

test("PackScaffoldService.scaffold generates full template structure", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "full",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "high",
  };

  const result = service.scaffold(config);

  // Full template has most files
  assert.ok(result.files.length >= 12);
});

test("PackScaffoldService.scaffold sanitizes packId in file content", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);

  // Read the generated manifest
  const manifestContent = readFileSync(result.manifestPath, "utf-8");
  const manifest = JSON.parse(manifestContent);

  assert.equal(manifest.packId, "test-pack");
  assert.equal(manifest.domainId, "test-domain");
});

test("PackScaffoldService.scaffold creates directory structure", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);

  // Check that key directories exist (by checking if entry files exist)
  const hasSrcDir = existsSync(join(result.rootDir, "src"));
  const hasTestsDir = existsSync(join(result.rootDir, "tests"));
  const hasToolsDir = existsSync(join(result.rootDir, "src", "tools"));

  assert.ok(hasSrcDir, "src directory should exist");
  assert.ok(hasTestsDir, "tests directory should exist");
  assert.ok(hasToolsDir, "src/tools directory should exist");
});

test("PackScaffoldService.scaffold creates manifest with capabilities", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);

  const manifestContent = readFileSync(result.manifestPath, "utf-8");
  const manifest = JSON.parse(manifestContent);

  assert.ok(Array.isArray(manifest.capabilities));
  assert.ok(manifest.capabilities.length > 0);
  assert.ok(manifest.capabilities[0].capabilityKey);
  assert.ok(manifest.capabilities[0].maturity);
});

test("PackScaffoldService.scaffold rejects packId starting with number", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "123test",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack ID must match pattern/,
  );
});

test("PackScaffoldService.scaffold handles valid packId with dots", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "my.pack.id",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);
  assert.ok(result.files.length > 0);
});

test("PackScaffoldService.scaffold handles valid packId with underscores", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "my_pack_id",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);
  assert.ok(result.files.length > 0);
});

test("PackScaffoldService.scaffold handles valid packId with hyphens", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "my-pack-id",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);
  assert.ok(result.files.length > 0);
});

test("PackScaffoldService.scaffold sets maxRiskClass in manifest", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "high",
  };

  const result = service.scaffold(config);

  const manifestContent = readFileSync(result.manifestPath, "utf-8");
  const manifest = JSON.parse(manifestContent);

  assert.equal(manifest.maxRiskClass, "high");
});

test("PackScaffoldService.scaffold sets owner in manifest", () => {
  const service = new PackScaffoldService();
  const config: ScaffoldConfig = {
    packId: "test-pack",
    name: "Test Pack",
    template: "minimal",
    domain: "test-domain",
    owner: "test-owner",
    riskLevel: "low",
  };

  const result = service.scaffold(config);

  const manifestContent = readFileSync(result.manifestPath, "utf-8");
  const manifest = JSON.parse(manifestContent);

  assert.equal(manifest.owner, "test-owner");
});
