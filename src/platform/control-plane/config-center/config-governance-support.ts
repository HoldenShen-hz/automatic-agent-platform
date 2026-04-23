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

import { createHash } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";
import type { SandboxPolicy } from "../iam/sandbox-policy.js";

/**
 * Configuration layer names that must be present in every bundle.
 * Each layer contains configuration for a specific system concern.
 */
export const REQUIRED_LAYER_NAMES = ["bootstrap", "gateways", "providers", "runtime", "security", "workflows"] as const;

/**
 * Schema for validating configuration field types and constraints.
 * Supports string, boolean, number, enum, array, and object field kinds.
 */
export type ConfigFieldSchema =
  | {
    kind: "string";
    issue: string;
    optional?: boolean;
    minLength?: number;
  }
  | {
    kind: "boolean";
    issue: string;
    optional?: boolean;
  }
  | {
    kind: "number";
    issue: string;
    optional?: boolean;
    integer?: boolean;
    minExclusive?: number;
  }
  | {
    kind: "enum";
    issue: string;
    optional?: boolean;
    values: readonly string[];
  }
  | {
    kind: "array";
    issue: string;
    optional?: boolean;
    minLength?: number;
    element: {
      kind: "string";
      minLength?: number;
    };
  }
  | {
    kind: "object";
    issue: string;
    optional?: boolean;
    shape: Record<string, ConfigFieldSchema>;
  };

/**
 * Schema for the bootstrap configuration layer.
 * Contains fundamental application settings.
 */
export const BOOTSTRAP_LAYER_SCHEMA: ConfigFieldSchema = {
  kind: "object",
  issue: "config.invalid_bootstrap",
  shape: {
    appName: { kind: "string", issue: "config.invalid_bootstrap.appName", minLength: 1 },
    phase: { kind: "string", issue: "config.invalid_bootstrap.phase", minLength: 1 },
    stableCoreEnabled: { kind: "boolean", issue: "config.invalid_bootstrap.stableCoreEnabled" },
  },
};

/**
 * Schema for the gateways configuration layer.
 * Contains gateway-related settings like default gateway and SSE.
 */
export const GATEWAYS_LAYER_SCHEMA: ConfigFieldSchema = {
  kind: "object",
  issue: "config.invalid_gateways",
  shape: {
    defaultGateway: { kind: "string", issue: "config.invalid_gateways.defaultGateway", minLength: 1 },
    sseEnabled: { kind: "boolean", issue: "config.invalid_gateways.sseEnabled" },
  },
};

/**
 * Schema for the providers configuration layer.
 * Contains default provider and model profile settings.
 */
export const PROVIDERS_LAYER_SCHEMA: ConfigFieldSchema = {
  kind: "object",
  issue: "config.invalid_providers",
  shape: {
    defaultProvider: { kind: "string", issue: "config.invalid_providers.defaultProvider", minLength: 1 },
    defaultModelProfile: { kind: "string", issue: "config.invalid_providers.defaultModelProfile", minLength: 1 },
  },
};

/**
 * Schema for the runtime configuration layer.
 * Contains task execution limits and concurrency settings.
 */
export const RUNTIME_LAYER_SCHEMA: ConfigFieldSchema = {
  kind: "object",
  issue: "config.invalid_runtime",
  shape: {
    defaultTaskTimeoutMs: {
      kind: "number",
      issue: "config.invalid_runtime.defaultTaskTimeoutMs",
      minExclusive: 0,
    },
    defaultStepTimeoutMs: {
      kind: "number",
      issue: "config.invalid_runtime.defaultStepTimeoutMs",
      minExclusive: 0,
    },
    maxConcurrentTasks: {
      kind: "number",
      issue: "config.invalid_runtime.maxConcurrentTasks",
      integer: true,
      minExclusive: 0,
    },
    maxAgentRounds: {
      kind: "number",
      issue: "config.invalid_runtime.maxAgentRounds",
      optional: true,
      integer: true,
      minExclusive: 0,
    },
    maxToolCalls: {
      kind: "number",
      issue: "config.invalid_runtime.maxToolCalls",
      optional: true,
      integer: true,
      minExclusive: 0,
    },
  },
};

/**
 * Schema for the security configuration layer.
 * Contains sandbox mode, approval mode, and destructive action settings.
 */
export const SECURITY_LAYER_SCHEMA: ConfigFieldSchema = {
  kind: "object",
  issue: "config.invalid_security",
  shape: {
    approvalMode: { kind: "string", issue: "config.invalid_security.approvalMode", minLength: 1 },
    sandboxMode: {
      kind: "enum",
      issue: "config.invalid_security.sandboxMode",
      values: ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"],
    },
    allowDestructiveActions: { kind: "boolean", issue: "config.invalid_security.allowDestructiveActions" },
    remoteWorkerRegistration: {
      kind: "object",
      issue: "config.invalid_security.remoteWorkerRegistration",
      shape: {
        challengeTtlMs: {
          kind: "number",
          issue: "config.invalid_security.remoteWorkerRegistration.challengeTtlMs",
          minExclusive: 0,
        },
        allowedCapabilities: {
          kind: "array",
          issue: "config.invalid_security.remoteWorkerRegistration.allowedCapabilities",
          minLength: 1,
          element: {
            kind: "string",
            minLength: 1,
          },
        },
      },
    },
  },
};

/**
 * Schema for the workflows configuration layer.
 * Contains default workflow and cross-division DAG settings.
 */
export const WORKFLOWS_LAYER_SCHEMA: ConfigFieldSchema = {
  kind: "object",
  issue: "config.invalid_workflows",
  shape: {
    defaultWorkflowId: { kind: "string", issue: "config.invalid_workflows.defaultWorkflowId", minLength: 1 },
    allowCrossDivisionDag: {
      kind: "boolean",
      issue: "config.invalid_workflows.allowCrossDivisionDag",
      optional: true,
    },
  },
};

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

export function parseJsonObject(raw: string, filePath: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonc(raw));
  } catch (error) {
    throw new ValidationError(
      `config.invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`,
      `config.invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError(`config.invalid_shape:${filePath}`, `config.invalid_shape:${filePath}`);
  }

  return parsed as Record<string, unknown>;
}

export function normalizeJsonc(raw: string): string {
  const withoutComments = stripJsonComments(raw);
  return stripTrailingCommas(withoutComments);
}

export function validateLayerSchema(
  layer: unknown,
  schema: ConfigFieldSchema,
  issues: string[],
): void {
  if (layer === undefined) {
    return;
  }
  validateConfigField(layer, schema, issues);
}

export function validateConfigField(
  value: unknown,
  schema: ConfigFieldSchema,
  issues: string[],
): boolean {
  if (value === undefined) {
    if (!schema.optional) {
      addConfigIssue(issues, schema.issue);
      return false;
    }
    return true;
  }

  switch (schema.kind) {
    case "string":
      if (typeof value !== "string" || value.trim().length < (schema.minLength ?? 0)) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      return true;
    case "boolean":
      if (typeof value !== "boolean") {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      return true;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      if (schema.integer && !Number.isInteger(value)) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      if (schema.minExclusive != null && value <= schema.minExclusive) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      return true;
    case "enum":
      if (typeof value !== "string" || !schema.values.includes(value)) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      return true;
    case "array":
      if (!Array.isArray(value) || value.length < (schema.minLength ?? 0)) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      if (value.some((entry) => typeof entry !== "string" || entry.trim().length < (schema.element.minLength ?? 0))) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      return true;
    case "object": {
      if (!isPlainObject(value)) {
        addConfigIssue(issues, schema.issue);
        return false;
      }
      let allValid = true;
      for (const [fieldName, fieldSchema] of Object.entries(schema.shape)) {
        const valid = validateConfigField(value[fieldName], fieldSchema, issues);
        if (!valid) allValid = false;
      }
      return allValid;
    }
  }
}

export function addConfigIssue(issues: string[], issue: string): void {
  if (!issues.includes(issue)) {
    issues.push(issue);
  }
}

export function stripJsonComments(raw: string): string {
  let output = "";
  let index = 0;
  let inString = false;
  let stringQuote = "\"";
  let escaping = false;

  while (index < raw.length) {
    const current = raw[index]!;
    const next = raw[index + 1] ?? "";

    if (inString) {
      output += current;
      if (escaping) {
        escaping = false;
      } else if (current === "\\") {
        escaping = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (current === "\"" || current === "'") {
      inString = true;
      stringQuote = current;
      output += current;
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      index += 2;
      while (index < raw.length && raw[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < raw.length) {
        if (raw[index] === "*" && (raw[index + 1] ?? "") === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

export function stripTrailingCommas(raw: string): string {
  let output = "";
  let index = 0;
  let inString = false;
  let stringQuote = "\"";
  let escaping = false;

  while (index < raw.length) {
    const current = raw[index]!;

    if (inString) {
      output += current;
      if (escaping) {
        escaping = false;
      } else if (current === "\\") {
        escaping = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (current === "\"" || current === "'") {
      inString = true;
      stringQuote = current;
      output += current;
      index += 1;
      continue;
    }

    if (current === ",") {
      let lookahead = index + 1;
      while (lookahead < raw.length && /\s/.test(raw[lookahead] ?? "")) {
        lookahead += 1;
      }
      const nextSignificant = raw[lookahead] ?? "";
      if (nextSignificant === "}" || nextSignificant === "]") {
        index += 1;
        continue;
      }
    }

    output += current;
    index += 1;
  }

  return output;
}

/**
 * Produces a deterministic JSON string for hashing.
 *
 * Sorts object keys alphabetically and uses consistent formatting
 * so that semantically equal objects produce identical strings.
 *
 * @param value - Any serializable value
 * @returns Deterministic JSON string
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value != null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function mergeConfigObjects(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      merged[key] = mergeConfigObjects(baseValue, overlayValue);
      continue;
    }
    merged[key] = overlayValue;
  }
  return merged;
}

/**
 * Computes SHA-256 hash of a string.
 *
 * @param value - String to hash
 * @returns Hex-encoded hash digest
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Type guard for positive finite numbers.
 *
 * @param value - Value to check
 * @returns True if value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

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
export function diffObjects(before: unknown, after: unknown, prefix: string = ""): ConfigDiffEntry[] {
  // Fast path: if string representation matches, no difference
  if (stableStringify(before) === stableStringify(after)) {
    return [];
  }

  // Both are plain objects: recurse into keys
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys]
      .sort()
      .flatMap((key) =>
        diffObjects(
          before[key],
          after[key],
          prefix.length > 0 ? `${prefix}.${key}` : key,
        ),
      );
  }

  // One side undefined means added or removed
  if (before === undefined) {
    return [{ path: prefix, changeType: "added", afterValue: after }];
  }
  if (after === undefined) {
    return [{ path: prefix, changeType: "removed", beforeValue: before }];
  }
  // Both defined but different: changed
  return [{ path: prefix, changeType: "changed", beforeValue: before, afterValue: after }];
}

/**
 * Type guard for plain objects (not arrays, not null).
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
