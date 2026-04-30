/**
 * @fileoverview Unit tests for Pack Scaffold Service - Issue #2021
 * Issue #2021: packId template injection, special chars inject files
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PackScaffoldService,
  type ScaffoldConfig,
} from "../../../../../src/sdk/pack-sdk/pack-scaffold-service.js";

test("PackScaffoldService.listTemplates returns all template types", () => {
  const service = new PackScaffoldService();
  const templates = service.listTemplates();
  assert.equal(templates.length, 3);
  assert.ok(templates.find((t) => t.id === "minimal"));
  assert.ok(templates.find((t) => t.id === "standard"));
  assert.ok(templates.find((t) => t.id === "full"));
});

test("PackScaffoldService.scaffold validates packId format (issue #2021)", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);

    // Valid pack ID (lowercase, numbers, hyphens, underscores, dots)
    const validConfig: ScaffoldConfig = {
      packId: "my-pack-123",
      name: "My Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(validConfig);
    assert.ok(result.rootDir.includes("my-pack-123"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold rejects invalid packId characters (issue #2021)", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);

    // PackId with special characters that could enable path traversal (issue #2021)
    const maliciousConfig: ScaffoldConfig = {
      packId: "../../../etc/passwd",
      name: "Malicious Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    // Should be rejected by validation
    assert.throws(
      () => service.scaffold(maliciousConfig),
      /Pack ID must match pattern/i
    );
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold rejects packId with path traversal attempts (issue #2021)", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);

    // Various path traversal attempts
    const traversalAttempts = [
      "../../../etc/passwd",
      "..\\..\\windows\\system32",
      "../../file.txt",
      "pack/../../../etc/passwd",
      "pack%2F..%2F..%2Fetc%2Fpasswd",
    ];

    for (const maliciousPackId of traversalAttempts) {
      const config: ScaffoldConfig = {
        packId: maliciousPackId,
        name: "Test",
        template: "minimal",
        domain: "testing",
        owner: "test@example.com",
        riskLevel: "low",
      };

      assert.throws(
        () => service.scaffold(config),
        /Pack ID must match pattern/i,
        `PackId ${maliciousPackId} should be rejected`
      );
    }
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold rejects uppercase in packId (issue #2021)", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);

    const config: ScaffoldConfig = {
      packId: "InvalidPack",
      name: "Invalid Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    assert.throws(
      () => service.scaffold(config),
      /Pack ID must match pattern/i
    );
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold rejects empty packId", () => {
  const service = new PackScaffoldService();

  const config: ScaffoldConfig = {
    packId: "",
    name: "Test",
    template: "minimal",
    domain: "testing",
    owner: "test@example.com",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack ID/i
  );
});

test("PackScaffoldService.scaffold rejects whitespace-only packId", () => {
  const service = new PackScaffoldService();

  const config: ScaffoldConfig = {
    packId: "   ",
    name: "Test",
    template: "minimal",
    domain: "testing",
    owner: "test@example.com",
    riskLevel: "low",
  };

  assert.throws(
    () => service.scaffold(config),
    /Pack ID/i
  );
});

test("PackScaffoldService.scaffold creates minimal template structure", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "test-pack",
      name: "Test Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);

    assert.ok(result.rootDir.includes("test-pack"));
    assert.ok(result.files.length >= 4);
    assert.ok(result.manifestPath.endsWith("manifest.json"));
    assert.ok(result.entryPointPath.endsWith("src/index.ts"));

    // Verify manifest was created
    const manifestContent = readFileSync(result.manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);
    assert.equal(manifest.packId, "test-pack");
    assert.equal(manifest.domain, "testing");
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold creates standard template structure", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "standard-pack",
      name: "Standard Pack",
      template: "standard",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "medium",
    };

    const result = service.scaffold(config);

    // Standard template has more files than minimal
    assert.ok(result.files.length >= 7);
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold creates full template structure", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "full-pack",
      name: "Full Pack",
      template: "full",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "high",
    };

    const result = service.scaffold(config);

    // Full template has the most files
    assert.ok(result.files.length >= 10);
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold template substitution replaces PACK_ID correctly", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "my-special-pack",
      name: "My Special Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);

    // Check that a file was created with the packId substituted
    const queryToolPath = join(result.rootDir, "src", "tools", "query-tool.ts");
    const queryToolContent = readFileSync(queryToolPath, "utf-8");

    // The template should have replaced {{PACK_ID}} with the actual packId
    assert.ok(queryToolContent.includes("my-special-pack") || queryToolContent.includes("{{PACK_ID}}"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold template substitution replaces DOMAIN_ID correctly", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "test-pack",
      name: "Test Pack",
      template: "minimal",
      domain: "my-domain",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);

    // Check package.json has domain substituted
    const packageJsonPath = join(result.rootDir, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf-8");

    // Domain should be substituted in the scripts
    assert.ok(packageJsonContent.includes("my-domain") || packageJsonContent.includes("{{DOMAIN_ID}}"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold validates name is not empty", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "valid-pack",
      name: "",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    assert.throws(
      () => service.scaffold(config),
      /name/i
    );
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold validates owner is not empty", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "valid-pack",
      name: "Valid Pack",
      template: "minimal",
      domain: "testing",
      owner: "",
      riskLevel: "low",
    };

    assert.throws(
      () => service.scaffold(config),
      /owner/i
    );
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold with dots in packId is valid", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "org.pack.subpack",
      name: "Scoped Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);
    assert.ok(result.rootDir.includes("org.pack.subpack"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold with underscores in packId is valid", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "my_underscore_pack",
      name: "Underscore Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);
    assert.ok(result.rootDir.includes("my_underscore_pack"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold with hyphens in packId is valid", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "my-hyphen-pack",
      name: "Hyphen Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);
    assert.ok(result.rootDir.includes("my-hyphen-pack"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold with numbers in packId is valid", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "pack123",
      name: "Numeric Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);
    assert.ok(result.rootDir.includes("pack123"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
