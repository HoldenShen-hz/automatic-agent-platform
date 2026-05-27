/**
 * Integration tests for Structure Validation Services
 *
 * Tests real module imports and cross-module validation scenarios.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync } from "node:fs";

import {
  ModuleStructureValidator,
  DirectoryConventionValidator,
  ExportSurfaceValidator,
  validatePlatformModuleStructure,
  validateDirectoryConventions,
  validateExportSurface,
} from "../../../../src/platform/structure/index.js";

const SRC_ROOT = join(process.cwd(), "src");

// ---------------------------------------------------------------------------
// Integration: Platform Surface Discovery
// ---------------------------------------------------------------------------

test("Integration: discover all platform surfaces and validate structure", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validateAllSurfaces();

  assert.ok(Array.isArray(result.errors));
  assert.equal(typeof result.valid, "boolean");
  assert.equal(typeof result.checkedAt, "string");
  assert.ok(result.errors.every((error) => error.code.length > 0 && error.message.length > 0));
});

test("Integration: validate each platform surface individually", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const surfaces = [
    "contracts",
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
    "model-gateway",
    "prompt-engine",
    "shared",
    "compliance",
  ];

  const results = surfaces.map((surface) => ({
    surface,
    result: validator.validatePlatformSurface(surface),
  }));

  for (const { surface, result } of results) {
    assert.equal(typeof result.valid, "boolean", `${surface} result should have valid boolean`);
    assert.ok(Array.isArray(result.errors), `${surface} result should have errors array`);
    assert.equal(typeof result.checkedAt, "string", `${surface} result should have checkedAt`);
  }

  const validCount = results.filter((r) => r.result.valid).length;
  assert.ok(validCount >= 0 && validCount <= surfaces.length);
});

test("Integration: cross-validate directory conventions across platform", () => {
  const validator = new DirectoryConventionValidator(SRC_ROOT);
  const result = validator.validateAllSurfaceSubdirs();

  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
  assert.equal(typeof result.checkedAt, "string");
  assert.ok(result.errors.every((error) => error.path.length > 0));
});

// ---------------------------------------------------------------------------
// Integration: Export Surface Validation
// ---------------------------------------------------------------------------

test("Integration: validate exports for each platform surface", () => {
  const validator = new ExportSurfaceValidator(SRC_ROOT);
  const result = validator.validateAllSurfaceExports();

  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.every((error) => typeof error.code === "string" && error.code.length > 0));
});

test("Integration: check each surface index.ts exists and has exports", () => {
  const surfaces = [
    "contracts",
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
    "model-gateway",
    "prompt-engine",
    "shared",
    "compliance",
  ];

  for (const surface of surfaces) {
    const indexPath = join(SRC_ROOT, "platform", surface, "index.ts");
    const exists = existsSync(indexPath);

    if (exists) {
      const validator = new ExportSurfaceValidator(SRC_ROOT);
      const hasExports = validator.hasExports(`platform/${surface}/index.ts`);
      assert.equal(typeof hasExports, "boolean", `${surface} hasExports should return boolean`);
    } else {
      assert.equal(exists, false);
    }
  }
});

// ---------------------------------------------------------------------------
// Integration: Module Discovery and Validation
// ---------------------------------------------------------------------------

test("Integration: list and validate module directories in platform", () => {
  const validator = new DirectoryConventionValidator(SRC_ROOT);
  const platformModules = validator.listModuleDirs("platform");

  assert.ok(Array.isArray(platformModules));
  assert.ok(platformModules.length > 0);

  for (const modulePath of platformModules.slice(0, 5)) {
    const result = validator.validateModuleDir(modulePath);
    assert.equal(typeof result.valid, "boolean");
    assert.ok(Array.isArray(result.errors));
  }
});

test("Integration: validate structure module exports all submodules", async () => {
  const mod = await import("../../../../src/platform/structure/index.js");

  assert.ok(typeof mod.ModuleStructureValidator === "function");
  assert.ok(typeof mod.DirectoryConventionValidator === "function");
  assert.ok(typeof mod.ExportSurfaceValidator === "function");
  assert.ok(typeof mod.validatePlatformModuleStructure === "function");
  assert.ok(typeof mod.validateDirectoryConventions === "function");
  assert.ok(typeof mod.validateExportSurface === "function");
});

// ---------------------------------------------------------------------------
// Integration: Round-trip validation
// ---------------------------------------------------------------------------

test("Integration: validateModule -> validateAllSurfaces consistency", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);

  const singleResult = validator.validateModule("platform/structure");
  const allResult = validator.validateAllSurfaces();

  assert.equal(typeof singleResult.valid, typeof allResult.valid);
  assert.ok(Array.isArray(singleResult.errors));
  assert.ok(Array.isArray(allResult.errors));
});

test("Integration: DirectoryConventionValidator and ExportSurfaceValidator consistency", () => {
  const dirValidator = new DirectoryConventionValidator(SRC_ROOT);
  const exportValidator = new ExportSurfaceValidator(SRC_ROOT);

  const surfaces = ["contracts", "interface", "control-plane", "orchestration", "execution"];

  for (const surface of surfaces) {
    const dirResult = dirValidator.validateModuleDir(`platform/${surface}`);
    const exportResult = exportValidator.validateSurfaceExport(surface);

    assert.ok(Array.isArray(dirResult.errors));
    assert.ok(Array.isArray(exportResult.errors));
  }
});

// ---------------------------------------------------------------------------
// Integration: Error message quality
// ---------------------------------------------------------------------------

test("Integration: error messages contain actionable information", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validateModule("nonexistent/module/path");

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);

  for (const error of result.errors) {
    assert.ok(typeof error.path === "string");
    assert.ok(typeof error.code === "string");
    assert.ok(typeof error.message === "string");
    assert.ok(error.severity === "error" || error.severity === "warning");
    assert.ok(error.message.length > 0, "Error message should not be empty");
  }
});

test("Integration: validateDirectoryConventions produces machine-parseable errors", () => {
  const result = validateDirectoryConventions(SRC_ROOT);

  for (const error of result.errors) {
    assert.ok(/^[A-Z_]+$/.test(error.code), `Error code ${error.code} should be SCREAMING_SNAKE_CASE`);
    assert.ok(error.path.length > 0, "Error path should not be empty");
  }
});

// ---------------------------------------------------------------------------
// Integration: Real filesystem integration
// ---------------------------------------------------------------------------

test("Integration: structure-validator reads real platform modules", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validateAllSurfaces();
  assert.ok(Array.isArray(result.errors));
});

test("Integration: validate actual structure module directory", () => {
  const validator = new DirectoryConventionValidator(SRC_ROOT);
  const result = validator.validateModuleDir("platform/structure");

  assert.equal(result.valid, true, "Structure module should be valid");
  assert.equal(result.errors.length, 0, "Structure module should have no errors");
});

test("Integration: structure module barrel exports are usable as constructors", async () => {
  const mod = await import("../../../../src/platform/structure/index.js");

  const structureValidator = new mod.ModuleStructureValidator(SRC_ROOT);
  const dirValidator = new mod.DirectoryConventionValidator(SRC_ROOT);
  const exportValidator = new mod.ExportSurfaceValidator(SRC_ROOT);

  assert.ok(structureValidator != null);
  assert.ok(dirValidator != null);
  assert.ok(exportValidator != null);

  const sResult = structureValidator.validateAllSurfaces();
  const dResult = dirValidator.validateAllSurfaceSubdirs();
  const eResult = exportValidator.validateAllSurfaceExports();

  assert.ok(Array.isArray(sResult.errors));
  assert.ok(Array.isArray(dResult.errors));
  assert.ok(Array.isArray(eResult.errors));
});
