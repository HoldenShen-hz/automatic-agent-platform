/**
 * Structure Validation Module
 *
 * Provides validation services for platform module structure, directory conventions,
 * and export requirements across the platform surface.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StructureValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface StructureValidationResult {
  readonly valid: boolean;
  readonly errors: readonly StructureValidationError[];
  readonly checkedAt: string;
}

export interface DirectoryConventionError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface DirectoryConventionResult {
  readonly valid: boolean;
  readonly errors: readonly DirectoryConventionError[];
  readonly checkedAt: string;
}

export interface ExportValidationError {
  readonly modulePath: string;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface ExportValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ExportValidationError[];
  readonly checkedAt: string;
}

// ---------------------------------------------------------------------------
// ModuleStructureValidator
// ---------------------------------------------------------------------------

const SURFACE_ID_PATTERNS = [
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
] as const;

export type PlatformSurfaceId = (typeof SURFACE_ID_PATTERNS)[number];

export class ModuleStructureValidator {
  private readonly rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
  }

  public validateModule(relativePath: string): StructureValidationResult {
    const errors: StructureValidationError[] = [];
    const fullPath = join(this.rootPath, relativePath);

    const indexPath = join(fullPath, "index.ts");
    if (!existsSync(indexPath)) {
      errors.push({
        path: fullPath,
        code: "MISSING_INDEX",
        message: `Module directory ${relativePath} missing index.ts`,
        severity: "error",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      checkedAt: new Date().toISOString(),
    };
  }

  public validatePlatformSurface(surfaceId: string): StructureValidationResult {
    const errors: StructureValidationError[] = [];

    if (!SURFACE_ID_PATTERNS.includes(surfaceId as PlatformSurfaceId)) {
      errors.push({
        path: `src/platform/${surfaceId}`,
        code: "UNKNOWN_SURFACE",
        message: `Unknown platform surface: ${surfaceId}`,
        severity: "error",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      checkedAt: new Date().toISOString(),
    };
  }

  public validateAllSurfaces(): StructureValidationResult {
    const allErrors: StructureValidationError[] = [];

    for (const surfaceId of SURFACE_ID_PATTERNS) {
      const surfacePath = join(this.rootPath, "src", "platform", surfaceId);
      if (!existsSync(surfacePath)) {
        allErrors.push({
          path: surfacePath,
          code: "MISSING_SURFACE",
          message: `Platform surface directory missing: ${surfaceId}`,
          severity: "error",
        });
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      checkedAt: new Date().toISOString(),
    };
  }
}

export function validatePlatformModuleStructure(rootPath: string = process.cwd()): StructureValidationResult {
  const validator = new ModuleStructureValidator(rootPath);
  return validator.validateAllSurfaces();
}

// ---------------------------------------------------------------------------
// DirectoryConventionValidator
// ---------------------------------------------------------------------------

const VALID_MODULE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const INDEX_FILENAME = "index.ts";

export class DirectoryConventionValidator {
  private readonly rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
  }

  public validateModuleDir(relativePath: string): DirectoryConventionResult {
    const errors: DirectoryConventionError[] = [];
    const fullPath = join(this.rootPath, relativePath);

    if (!existsSync(fullPath)) {
      return {
        valid: false,
        errors: [
          {
            path: fullPath,
            code: "DIR_NOT_FOUND",
            message: `Directory does not exist: ${relativePath}`,
            severity: "error",
          },
        ],
        checkedAt: new Date().toISOString(),
      };
    }

    const name = relativePath.split("/").pop() ?? "";

    if (!VALID_MODULE_NAME_PATTERN.test(name)) {
      errors.push({
        path: name,
        code: "INVALID_MODULE_NAME",
        message: `Module name "${name}" must match pattern: ${VALID_MODULE_NAME_PATTERN.source}`,
        severity: "error",
      });
    }

    const indexPath = join(fullPath, INDEX_FILENAME);
    if (!existsSync(indexPath)) {
      errors.push({
        path: relativePath,
        code: "MISSING_INDEX",
        message: `Module directory missing ${INDEX_FILENAME}`,
        severity: "error",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      checkedAt: new Date().toISOString(),
    };
  }

  public validateAllSurfaceSubdirs(): DirectoryConventionResult {
    const allErrors: DirectoryConventionError[] = [];
    const platformPath = join(this.rootPath, "src", "platform");

    if (!existsSync(platformPath)) {
      return {
        valid: false,
        errors: [
          {
            path: platformPath,
            code: "PLATFORM_ROOT_MISSING",
            message: "Platform root src/platform does not exist",
            severity: "error",
          },
        ],
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      checkedAt: new Date().toISOString(),
    };
  }

  public listModuleDirs(relativePath: string): string[] {
    const fullPath = join(this.rootPath, relativePath);

    if (!existsSync(fullPath)) {
      return [];
    }

    try {
      return readdirSync(fullPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
        .map((entry) => join(relativePath, entry.name));
    } catch (error) {
      throw new Error(
        `platform_structure.list_module_dirs_failed:${relativePath}:${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export function validateDirectoryConventions(rootPath: string = process.cwd()): DirectoryConventionResult {
  const validator = new DirectoryConventionValidator(rootPath);
  return validator.validateAllSurfaceSubdirs();
}

// ---------------------------------------------------------------------------
// ExportSurfaceValidator
// ---------------------------------------------------------------------------

export interface ExportRequirement {
  readonly modulePattern: RegExp;
  readonly mustExport: readonly string[];
  readonly description: string;
}

import { readFileSync } from "node:fs";

export class ExportSurfaceValidator {
  private readonly rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
  }

  public validateModuleExports(modulePath: string, expectedExports: readonly string[]): ExportValidationResult {
    const errors: ExportValidationError[] = [];
    const fullPath = join(this.rootPath, modulePath);

    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      return {
        valid: false,
        errors: [
          {
            modulePath,
            code: "MODULE_NOT_FOUND",
            message: `Cannot read module at ${modulePath}`,
            severity: "error",
          },
        ],
        checkedAt: new Date().toISOString(),
      };
    }

    for (const expected of expectedExports) {
      const exportPattern = new RegExp(`export\\s+.*\\b${expected}\\b|export\\s*\\{[^}]*\\b${expected}\\b[^}]*\\}`, "g");
      if (!exportPattern.test(content)) {
        errors.push({
          modulePath,
          code: "MISSING_EXPORT",
          message: `Expected export "${expected}" not found in ${modulePath}`,
          severity: "error",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      checkedAt: new Date().toISOString(),
    };
  }

  public validateSurfaceExport(surfaceId: string): ExportValidationResult {
    const errors: ExportValidationError[] = [];

    const validSurfaces = [
      "contracts", "interface", "control-plane", "orchestration", "execution",
      "state-evidence", "model-gateway", "prompt-engine", "shared", "compliance",
    ];

    if (!validSurfaces.includes(surfaceId)) {
      errors.push({
        modulePath: `src/platform/${surfaceId}/index.ts`,
        code: "INVALID_SURFACE",
        message: `Unknown platform surface: ${surfaceId}`,
        severity: "error",
      });
    }

    const indexPath = join(this.rootPath, "src", "platform", surfaceId, "index.ts");
    try {
      readFileSync(indexPath, "utf-8");
    } catch {
      errors.push({
        modulePath: `src/platform/${surfaceId}/index.ts`,
        code: "MISSING_INDEX",
        message: `Surface index.ts not found: ${surfaceId}`,
        severity: "error",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      checkedAt: new Date().toISOString(),
    };
  }

  public validateAllSurfaceExports(): ExportValidationResult {
    const allErrors: ExportValidationError[] = [];

    const surfaces = [
      "contracts", "interface", "control-plane", "orchestration", "execution",
      "state-evidence", "model-gateway", "prompt-engine", "shared", "compliance",
    ];

    for (const surface of surfaces) {
      const result = this.validateSurfaceExport(surface);
      allErrors.push(...result.errors);
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      checkedAt: new Date().toISOString(),
    };
  }

  public hasExports(modulePath: string): boolean {
    const fullPath = join(this.rootPath, modulePath);

    try {
      const content = readFileSync(fullPath, "utf-8");
      return content.includes("export") && (content.includes("export ") || content.includes("export{"));
    } catch {
      return false;
    }
  }
}

export function validateExportSurface(rootPath: string = process.cwd()): ExportValidationResult {
  const validator = new ExportSurfaceValidator(rootPath);
  return validator.validateAllSurfaceExports();
}
