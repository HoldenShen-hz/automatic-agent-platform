/**
 * @fileoverview SchemaRegistry - Domain input/output schema version management
 *
 * Implements §37: Domain input/output schema version management + compatibility check.
 * Provides registry for domain schemas with version tracking and compatibility validation.
 */

import { ValidationError } from "../../platform/contracts/errors.js";

/**
 * Schema version entry for tracking schema evolution.
 */
export interface SchemaVersionEntry {
  readonly domainId: string;
  readonly schemaType: "input" | "output" | "contract";
  readonly schemaId: string;
  readonly version: string;
  readonly schema: Record<string, unknown>;
  readonly createdAt: string;
  readonly deprecatedAt: string | null;
  readonly isActive: boolean;
}

/**
 * Schema compatibility check result.
 */
export interface SchemaCompatibilityResult {
  readonly compatible: boolean;
  readonly breakingChanges: readonly string[];
  readonly warnings: readonly string[];
  readonly migrationHints: readonly string[];
}

/**
 * SchemaRegistry - manages domain schemas with version tracking and compatibility checks.
 *
 * Per §37, provides:
 * - Domain input/output schema version management
 * - Compatibility checking between schema versions
 * - Schema deprecation and lifecycle management
 */
export class SchemaRegistry {
  private readonly schemas = new Map<string, SchemaVersionEntry>();
  private readonly schemaVersions = new Map<string, Map<string, SchemaVersionEntry>>();

  /**
   * Register a schema for a domain.
   * @param entry Schema version entry to register
   * @returns The registered schema entry
   */
  public register(entry: SchemaVersionEntry): SchemaVersionEntry {
    const key = this.makeKey(entry.domainId, entry.schemaType, entry.schemaId);
    const existing = this.schemas.get(key);

    if (existing && existing.version === entry.version) {
      throw new ValidationError("schema_registry.duplicate_version", `Schema ${entry.schemaId} version ${entry.version} already registered.`);
    }

    // Mark existing version as deprecated if we're adding a new version
    if (existing && existing.isActive) {
      const deprecated: SchemaVersionEntry = {
        ...existing,
        isActive: false,
        deprecatedAt: entry.createdAt,
      };
      this.schemas.set(key, deprecated);

      // Update version tracking
      const versionMap = this.schemaVersions.get(key);
      if (versionMap) {
        versionMap.set(existing.version, deprecated);
      }
    }

    this.schemas.set(key, entry);

    // Track version history
    if (!this.schemaVersions.has(key)) {
      this.schemaVersions.set(key, new Map());
    }
    this.schemaVersions.get(key)!.set(entry.version, entry);

    return entry;
  }

  /**
   * Get the latest active version of a schema.
   * @param domainId Domain identifier
   * @param schemaType Type of schema (input/output/contract)
   * @param schemaId Schema identifier
   * @returns Schema entry or null if not found
   */
  public getLatest(domainId: string, schemaType: "input" | "output" | "contract", schemaId: string): SchemaVersionEntry | null {
    const key = this.makeKey(domainId, schemaType, schemaId);
    const versions = this.schemaVersions.get(key);
    if (!versions || versions.size === 0) return null;

    // Find the most recent active version
    let latest: SchemaVersionEntry | null = null;
    for (const entry of versions.values()) {
      if (entry.isActive) {
        if (!latest || entry.createdAt > latest.createdAt) {
          latest = entry;
        }
      }
    }
    return latest;
  }

  /**
   * Get a specific version of a schema.
   * @param domainId Domain identifier
   * @param schemaType Type of schema
   * @param schemaId Schema identifier
   * @param version Version string
   * @returns Schema entry or null if not found
   */
  public getVersion(domainId: string, schemaType: "input" | "output" | "contract", schemaId: string, version: string): SchemaVersionEntry | null {
    const key = this.makeKey(domainId, schemaType, schemaId);
    return this.schemaVersions.get(key)?.get(version) ?? null;
  }

  /**
   * List all versions of a schema.
   * @param domainId Domain identifier
   * @param schemaType Type of schema
   * @param schemaId Schema identifier
   * @returns Array of schema versions (oldest first)
   */
  public listVersions(domainId: string, schemaType: "input" | "output" | "contract", schemaId: string): readonly SchemaVersionEntry[] {
    const key = this.makeKey(domainId, schemaType, schemaId);
    const versions = this.schemaVersions.get(key);
    if (!versions) return [];

    return Array.from(versions.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * Check compatibility between two schema versions.
   * Per §37, performs compatibility check for schema evolution.
   * @param fromVersion Source schema version entry
   * @param toVersion Target schema version entry
   * @returns Compatibility result
   */
  public checkCompatibility(fromVersion: SchemaVersionEntry, toVersion: SchemaVersionEntry): SchemaCompatibilityResult {
    const breakingChanges: string[] = [];
    const warnings: string[] = [];
    const migrationHints: string[] = [];

    // Same version is compatible
    if (fromVersion.version === toVersion.version) {
      return { compatible: true, breakingChanges: [], warnings: [], migrationHints: [] };
    }

    const fromSchema = fromVersion.schema as { properties?: Record<string, unknown> };
    const toSchema = toVersion.schema as { properties?: Record<string, unknown> };

    const fromProps = fromSchema.properties ?? {};
    const toProps = toSchema.properties ?? {};

    // Check for removed required fields (breaking)
    for (const [propName, propDef] of Object.entries(fromProps)) {
      const fromProp = propDef as { required?: boolean };
      if (fromProp.required && !(propName in toProps)) {
        breakingChanges.push(`Required property '${propName}' was removed`);
      }
    }

    // Check for changed field types (breaking)
    for (const [propName, propDef] of Object.entries(toProps)) {
      const toProp = propDef as { type?: string };
      if (propName in fromProps) {
        const fromProp = fromProps[propName] as { type?: string };
        if (fromProp.type !== toProp.type) {
          breakingChanges.push(`Property '${propName}' type changed from '${fromProp.type}' to '${toProp.type}'`);
        }
      }
    }

    // Check for new optional fields (additive, not breaking)
    for (const propName of Object.keys(toProps)) {
      if (!(propName in fromProps)) {
        warnings.push(`New optional property '${propName}' added`);
        migrationHints.push(`Consider adding '${propName}' to your integration`);
      }
    }

    return {
      compatible: breakingChanges.length === 0,
      breakingChanges,
      warnings,
      migrationHints,
    };
  }

  /**
   * Deprecate a specific schema version.
   * @param domainId Domain identifier
   * @param schemaType Type of schema
   * @param schemaId Schema identifier
   * @param version Version to deprecate
   * @param deprecatedAt Timestamp of deprecation
   */
  public deprecate(domainId: string, schemaType: "input" | "output" | "contract", schemaId: string, version: string, deprecatedAt: string): boolean {
    const key = this.makeKey(domainId, schemaType, schemaId);
    const entry = this.schemaVersions.get(key)?.get(version);
    if (!entry) return false;

    const deprecated: SchemaVersionEntry = {
      ...entry,
      isActive: false,
      deprecatedAt,
    };

    this.schemas.set(key, deprecated);
    this.schemaVersions.get(key)?.set(version, deprecated);
    return true;
  }

  /**
   * List all schemas for a domain.
   * @param domainId Domain identifier
   * @returns Array of latest schema entries for the domain
   */
  public listForDomain(domainId: string): readonly SchemaVersionEntry[] {
    const result: SchemaVersionEntry[] = [];
    for (const entry of this.schemas.values()) {
      if (entry.domainId === domainId && entry.isActive) {
        result.push(entry);
      }
    }
    return result;
  }

  private makeKey(domainId: string, schemaType: "input" | "output" | "contract", schemaId: string): string {
    return `${domainId}:${schemaType}:${schemaId}`;
  }
}

// Singleton instance for global registry access
let GLOBAL_SCHEMA_REGISTRY: SchemaRegistry | null = null;

export function getSchemaRegistry(): SchemaRegistry {
  if (!GLOBAL_SCHEMA_REGISTRY) {
    GLOBAL_SCHEMA_REGISTRY = new SchemaRegistry();
  }
  return GLOBAL_SCHEMA_REGISTRY;
}

export function resetSchemaRegistry(): void {
  GLOBAL_SCHEMA_REGISTRY = null;
}