/**
 * @fileoverview Configuration Governance Service
 *
 * Manages loading, validation, and integrity checking of layered configuration bundles.
 *
 * Configuration is organized into layers (bootstrap, gateways, providers, runtime,
 * security, workflows) that are merged to form a complete runtime configuration. This
 * service handles:
 *
 * - Loading configuration from the filesystem with sandbox path validation
 * - Computing cryptographic hashes for tamper detection
 * - Validating required fields and value constraints per layer
 * - Comparing configuration bundles to detect drift
 * - Enforcing production safety checks (e.g., destructive actions)
 *
 * Security model:
 * - All file paths are validated against a sandbox policy
 * - Version hashes allow detection of unauthorized configuration changes
 * - Production environment enforces stricter constraints
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/configuration_layers_and_defaults_contract.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/governance/glossary_and_terminology.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/architecture/00-platform-architecture.md}
 *
 * @packageDocumentation
 */
import type { SandboxPolicy } from "../iam/sandbox-policy.js";
/**
 * Configuration layer names that must be present in every bundle.
 * Each layer contains configuration for a specific system concern.
 */
export declare const REQUIRED_LAYER_NAMES: readonly ["bootstrap", "gateways", "providers", "runtime", "security", "workflows"];
/**
 * Schema for validating configuration field types and constraints.
 * Supports string, boolean, number, enum, array, and object field kinds.
 */
export type ConfigFieldSchema = {
    kind: "string";
    issue: string;
    optional?: boolean;
    minLength?: number;
} | {
    kind: "boolean";
    issue: string;
    optional?: boolean;
} | {
    kind: "number";
    issue: string;
    optional?: boolean;
    integer?: boolean;
    minExclusive?: number;
} | {
    kind: "enum";
    issue: string;
    optional?: boolean;
    values: readonly string[];
} | {
    kind: "array";
    issue: string;
    optional?: boolean;
    minLength?: number;
    element: {
        kind: "string";
        minLength?: number;
    };
} | {
    kind: "object";
    issue: string;
    optional?: boolean;
    shape: Record<string, ConfigFieldSchema>;
};
/**
 * Schema for the bootstrap configuration layer.
 * Contains fundamental application settings.
 */
export declare const BOOTSTRAP_LAYER_SCHEMA: ConfigFieldSchema;
/**
 * Schema for the gateways configuration layer.
 * Contains gateway-related settings like default gateway and SSE.
 */
export declare const GATEWAYS_LAYER_SCHEMA: ConfigFieldSchema;
/**
 * Schema for the providers configuration layer.
 * Contains default provider and model profile settings.
 */
export declare const PROVIDERS_LAYER_SCHEMA: ConfigFieldSchema;
/**
 * Schema for the runtime configuration layer.
 * Contains task execution limits and concurrency settings.
 */
export declare const RUNTIME_LAYER_SCHEMA: ConfigFieldSchema;
/**
 * Schema for the security configuration layer.
 * Contains sandbox mode, approval mode, and destructive action settings.
 */
export declare const SECURITY_LAYER_SCHEMA: ConfigFieldSchema;
/**
 * Schema for the workflows configuration layer.
 * Contains default workflow and cross-division DAG settings.
 */
export declare const WORKFLOWS_LAYER_SCHEMA: ConfigFieldSchema;
/**
 * Version information for a configuration bundle.
 * Used for tamper detection and caching - if the versionId changes,
 * the configuration has been modified.
 */
export interface ConfigVersion {
    /** Short identifier derived from bundle hash for comparison */
    versionId: string;
    /** SHA-256 hash of the entire configuration bundle */
    bundleHash: string;
    /** SHA-256 hashes of individual layers for change detection */
    layerHashes: Record<string, string>;
    /** ISO timestamp when version was generated */
    generatedAt: string;
}
/**
 * A loaded and parsed configuration bundle.
 *
 * Contains all configuration layers merged together with version
 * metadata for integrity checking. The bundle is validated before use.
 */
export interface ConfigBundle {
    /** Environment name (e.g., "dev", "prod") */
    environment: string;
    /** Normalized path to configuration root directory */
    configRoot: string;
    /** Version information for tamper detection */
    version: ConfigVersion;
    /** Loaded configuration layers keyed by layer name */
    layers: Record<string, Record<string, unknown>>;
    /** Validation issues found during bundle loading */
    issues: string[];
}
/**
 * Represents a single difference between two configuration bundles.
 *
 * Used for change tracking and drift detection between environments
 * or before/after comparisons during updates.
 */
export interface ConfigDiffEntry {
    /** Dot-notation path to the changed configuration value */
    path: string;
    /** Type of change detected */
    changeType: "added" | "removed" | "changed";
    /** Previous value (for removed or changed) */
    beforeValue?: unknown;
    /** New value (for added or changed) */
    afterValue?: unknown;
}
/**
 * Options for configuring the governance service behavior.
 */
export interface ConfigGovernanceServiceOptions {
    /** Override the default config root path */
    configRoot?: string;
    /** Override the default sandbox policy for path validation */
    sandboxPolicy?: SandboxPolicy;
}
/**
 * Service for managing configuration loading, validation, and tamper detection.
 *
 * Provides governance capabilities for the layered configuration system:
 * - Secure loading from filesystem with path sandboxing
 * - Cryptographic hashing for integrity verification
 * - Layer and value validation with detailed error reporting
 * - Configuration diffing between bundles
 * - Production safety checks
 *
 * All file access is validated against a sandbox policy to prevent
 * directory traversal attacks and enforce workspace boundaries.
 */
export declare function parseJsonObject(raw: string, filePath: string): Record<string, unknown>;
export declare function normalizeJsonc(raw: string): string;
export declare function validateLayerSchema(layer: unknown, schema: ConfigFieldSchema, issues: string[]): void;
export declare function validateConfigField(value: unknown, schema: ConfigFieldSchema, issues: string[]): boolean;
export declare function addConfigIssue(issues: string[], issue: string): void;
export declare function stripJsonComments(raw: string): string;
export declare function stripTrailingCommas(raw: string): string;
/**
 * Produces a deterministic JSON string for hashing.
 *
 * Sorts object keys alphabetically and uses consistent formatting
 * so that semantically equal objects produce identical strings.
 *
 * @param value - Any serializable value
 * @returns Deterministic JSON string
 */
export declare function stableStringify(value: unknown): string;
export declare function mergeConfigObjects(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown>;
/**
 * Computes SHA-256 hash of a string.
 *
 * @param value - String to hash
 * @returns Hex-encoded hash digest
 */
export declare function sha256(value: string): string;
/**
 * Type guard for positive finite numbers.
 *
 * @param value - Value to check
 * @returns True if value is a positive number
 */
export declare function isPositiveNumber(value: unknown): value is number;
/**
 * Computes the differences between two arbitrary values.
 *
 * Performs deep recursive comparison and returns individual
 * leaf changes in dot-notation paths. Arrays are compared
 * as values (not by index) since they represent ordered sequences.
 *
 * @param before - Earlier value
 * @param after - Later value
 * @param prefix - Dot-notation path prefix for nested values
 * @returns Array of change entries
 */
export declare function diffObjects(before: unknown, after: unknown, prefix?: string): ConfigDiffEntry[];
/**
 * Type guard for plain objects (not arrays, not null).
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 */
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
