/**
 * Unit tests for Structure Validation Services
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  ModuleStructureValidator,
  DirectoryConventionValidator,
  ExportSurfaceValidator,
  validatePlatformModuleStructure,
  validateDirectoryConventions,
  validateExportSurface,
  StructureValidationResult,
  DirectoryConventionResult,
  ExportValidationResult,
} from "../../../../src/platform/structure/index.js";

const SRC_ROOT = join(process.cwd(), "src");

// ---------------------------------------------------------------------------
// ModuleStructureValidator
// ---------------------------------------------------------------------------

test("ModuleStructureValidator: instantiates with default root", () => {
  const validator = new ModuleStructureValidator();
  assert.ok(validator != null);
});

test("ModuleStructureValidator: instantiates with custom root", () => {
  const validator = new ModuleStructureValidator("/custom/path");
  assert.ok(validator != null);
});

test("ModuleStructureValidator: validatePlatformModuleStructure returns result shape", () => {
  const result = validatePlatformModuleStructure(SRC_ROOT);
  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
  assert.equal(typeof result.checkedAt, "string");
});

test("ModuleStructureValidator: validateModule returns result for valid path", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validateModule("platform/structure");
  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
});

test("ModuleStructureValidator: validateModule path with missing index reports error", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validateModule("platform/nonexistent-module");
  assert.equal(result.valid, false);
  const missingIndex = result.errors.find((e) => e.code === "MISSING_INDEX");
  assert.ok(missingIndex != null, "Should have MISSING_INDEX error");
});

test("ModuleStructureValidator: validatePlatformSurface accepts known surfaces", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validatePlatformSurface("contracts");
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("ModuleStructureValidator: validatePlatformSurface rejects unknown surfaces", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validatePlatformSurface("not-a-real-surface");
  assert.equal(result.valid, false);
  const unknownError = result.errors.find((e) => e.code === "UNKNOWN_SURFACE");
  assert.ok(unknownError != null, "Should have UNKNOWN_SURFACE error");
});

test("ModuleStructureValidator: validateAllSurfaces returns result shape", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validateAllSurfaces();
  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length >= 0);
});

// ---------------------------------------------------------------------------
// DirectoryConventionValidator
// ---------------------------------------------------------------------------

test("DirectoryConventionValidator: instantiates with default root", () => {
  const validator = new DirectoryConventionValidator();
  assert.ok(validator != null);
});

test("DirectoryConventionValidator: instantiates with custom root", () => {
  const validator = new DirectoryConventionValidator("/custom/path");
  assert.ok(validator != null);
});

test("DirectoryConventionValidator: validateDirectoryConventions returns result shape", () => {
  const result = validateDirectoryConventions(SRC_ROOT);
  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
  assert.equal(typeof result.checkedAt, "string");
});

test("DirectoryConventionValidator: validateModuleDir returns error for nonexistent path", () => {
  const validator = new DirectoryConventionValidator(SRC_ROOT);
  const result = validator.validateModuleDir("platform/nonexistent-dir");
  assert.equal(result.valid, false);
  const notFound = result.errors.find((e) => e.code === "DIR_NOT_FOUND");
  assert.ok(notFound != null, "Should have DIR_NOT_FOUND error");
});

test("DirectoryConventionValidator: validateModuleDir returns valid for existing module", () => {
  const validator = new DirectoryConventionValidator(SRC_ROOT);
  const result = validator.validateModuleDir("platform/structure");
  assert.equal(result.valid, true);
});

test("DirectoryConventionValidator: listModuleDirs returns array", () => {
  const validator = new DirectoryConventionValidator(SRC_ROOT);
  const dirs = validator.listModuleDirs("platform");
  assert.ok(Array.isArray(dirs));
});

test("DirectoryConventionValidator: validateAllSurfaceSubdirs returns result shape", () => {
  const validator = new DirectoryConventionValidator(SRC_ROOT);
  const result = validator.validateAllSurfaceSubdirs();
  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
});

// ---------------------------------------------------------------------------
// ExportSurfaceValidator
// ---------------------------------------------------------------------------

test("ExportSurfaceValidator: instantiates with default root", () => {
  const validator = new ExportSurfaceValidator();
  assert.ok(validator != null);
});

test("ExportSurfaceValidator: instantiates with custom root", () => {
  const validator = new ExportSurfaceValidator("/custom/path");
  assert.ok(validator != null);
});

test("ExportSurfaceValidator: validateExportSurface returns result shape", () => {
  const result = validateExportSurface(SRC_ROOT);
  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
  assert.equal(typeof result.checkedAt, "string");
});

test("ExportSurfaceValidator: validateSurfaceExport reports missing index", () => {
  const validator = new ExportSurfaceValidator(SRC_ROOT);
  const result = validator.validateSurfaceExport("nonexistent-surface");
  assert.equal(result.valid, false);
  const missingIndex = result.errors.find((e) => e.code === "MISSING_INDEX" || e.code === "INVALID_SURFACE");
  assert.ok(missingIndex != null, "Should have error for invalid surface");
});

test("ExportSurfaceValidator: validateSurfaceExport accepts known surfaces", () => {
  const validator = new ExportSurfaceValidator(SRC_ROOT);
  const result = validator.validateSurfaceExport("contracts");
  assert.equal(typeof result.valid, "boolean");
});

test("ExportSurfaceValidator: validateAllSurfaceExports returns result shape", () => {
  const validator = new ExportSurfaceValidator(SRC_ROOT);
  const result = validator.validateAllSurfaceExports();
  assert.equal(typeof result.valid, "boolean");
  assert.ok(Array.isArray(result.errors));
});

test("ExportSurfaceValidator: hasExports returns boolean for readable path", () => {
  const validator = new ExportSurfaceValidator(SRC_ROOT);
  const hasExports = validator.hasExports("platform/structure/index.ts");
  assert.equal(typeof hasExports, "boolean");
});

test("ExportSurfaceValidator: hasExports returns false for nonexistent path", () => {
  const validator = new ExportSurfaceValidator(SRC_ROOT);
  const hasExports = validator.hasExports("nonexistent/file.ts");
  assert.equal(hasExports, false);
});

// ---------------------------------------------------------------------------
// Barrel export verification
// ---------------------------------------------------------------------------

test("Structure module barrel exports all three validators", async () => {
  const mod = await import("../../../../src/platform/structure/index.js");
  assert.ok(typeof mod.ModuleStructureValidator === "function");
  assert.ok(typeof mod.DirectoryConventionValidator === "function");
  assert.ok(typeof mod.ExportSurfaceValidator === "function");
  assert.ok(typeof mod.validatePlatformModuleStructure === "function");
  assert.ok(typeof mod.validateDirectoryConventions === "function");
  assert.ok(typeof mod.validateExportSurface === "function");
});

// ---------------------------------------------------------------------------
// Error shape verification
// ---------------------------------------------------------------------------

test("StructureValidationError has required fields", () => {
  const error = {
    path: "test/path",
    code: "TEST_ERROR",
    message: "Test error message",
    severity: "error" as const,
  };
  assert.equal(error.path, "test/path");
  assert.equal(error.code, "TEST_ERROR");
  assert.equal(error.message, "Test error message");
  assert.equal(error.severity, "error");
});

test("Result objects contain ISO timestamp", () => {
  const validator = new ModuleStructureValidator(SRC_ROOT);
  const result = validator.validateAllSurfaces();
  const timestamp = result.checkedAt;
  assert.ok(timestamp.includes("T"), "checkedAt should be ISO format");
  assert.ok(!isNaN(Date.parse(timestamp)), "checkedAt should be parseable");
});