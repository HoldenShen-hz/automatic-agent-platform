/**
 * Config Governance Service
 */

export * from "./config-governance-support.js";

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath, createWorkspaceWritePolicy, type SandboxPolicy } from "../iam/sandbox-policy.js";
import { loadModelMetadataRegistry } from "./model-metadata-registry.js";
import {
  BOOTSTRAP_LAYER_SCHEMA,
  GATEWAYS_LAYER_SCHEMA,
  PROVIDERS_LAYER_SCHEMA,
  REQUIRED_LAYER_NAMES,
  RUNTIME_LAYER_SCHEMA,
  SECURITY_LAYER_SCHEMA,
  WORKFLOWS_LAYER_SCHEMA,
  diffObjects,
  isPlainObject,
  mergeConfigObjects,
  parseJsonObject,
  sha256,
  stableStringify,
  validateLayerSchema,
  type ConfigBundle,
  type ConfigDiffEntry,
  type ConfigGovernanceServiceOptions,
  type ConfigVersion,
} from "./config-governance-support.js";

export class ConfigGovernanceService {
  private readonly configRoot: string;
  private readonly sandboxPolicy: SandboxPolicy;

  /**
   * Creates a new ConfigGovernanceService.
   *
   * @param options - Configuration options (all optional)
   * @param options.configRoot - Override default config root path
   * @param options.sandboxPolicy - Override default sandbox policy
   */
  public constructor(options: ConfigGovernanceServiceOptions = {}) {
    this.configRoot = options.configRoot ?? join(process.cwd(), "config");
    this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(this.configRoot);
  }

  /**
   * Loads and parses a complete configuration bundle for an environment.
   *
   * Validates paths against sandbox policy, loads all layer files,
   * computes hashes, and validates the bundle structure.
   *
   * @param environment - Environment name (e.g., "dev", "staging", "prod")
   * @returns Loaded and validated configuration bundle
   * @throws Error if sandbox denies access or bundle is invalid
   */
  public loadBundle(environment: string = "dev"): ConfigBundle {
    const rootCheck = checkSandboxPath(this.sandboxPolicy, this.configRoot);
    if (!rootCheck.allowed) {
      throw new PolicyDeniedError(rootCheck.reasonCode ?? "config.root_denied", rootCheck.reasonCode ?? "config.root_denied");
    }

    if (!existsSync(rootCheck.normalizedPath)) {
      throw new ValidationError("config.root_missing", "config.root_missing");
    }

    const layers: Record<string, Record<string, unknown>> = {};
    const layerHashes: Record<string, string> = {};
    // Restrict file access to within the config root
    const effectivePolicy = {
      ...this.sandboxPolicy,
      allowedRoots: [rootCheck.normalizedPath],
    };

    for (const layerName of this.listLayerNames(rootCheck.normalizedPath)) {
      const parsed = this.loadLayerConfig(rootCheck.normalizedPath, layerName, environment, effectivePolicy);
      layers[layerName] = parsed;
      layerHashes[layerName] = sha256(stableStringify(parsed));
    }

    const version = this.buildVersion(layerHashes);
    return {
      environment,
      configRoot: rootCheck.normalizedPath,
      version,
      layers,
      issues: this.validateBundle({
        environment,
        configRoot: rootCheck.normalizedPath,
        version,
        layers,
        issues: [],
      }),
    };
  }

  /**
   * Detects unauthorized configuration changes by comparing version IDs.
   *
   * Useful for detecting tampering or drift between expected and actual
   * configuration state.
   *
   * @param expectedVersionId - Version ID that was previously recorded as valid
   * @param environment - Environment to check
   * @returns Tampering detection result with current version and issues
   */
  public detectTampering(expectedVersionId: string, environment: string = "dev"): {
    tampered: boolean;
    currentVersion: string;
    issues: string[];
  } {
    const bundle = this.loadBundle(environment);
    return {
      tampered: bundle.version.versionId !== expectedVersionId || bundle.issues.length > 0,
      currentVersion: bundle.version.versionId,
      issues:
        bundle.version.versionId !== expectedVersionId
          ? ["config.version_mismatch", ...bundle.issues]
          : bundle.issues,
    };
  }

  /**
   * Computes the differences between two configuration bundles.
   *
   * Performs deep comparison of layer contents and returns individual
   * value changes in dot-notation paths.
   *
   * @param before - The earlier configuration bundle
   * @param after - The later configuration bundle
   * @returns Array of changes detected between bundles
   */
  public diffBundles(before: ConfigBundle, after: ConfigBundle): ConfigDiffEntry[] {
    return diffObjects(before.layers, after.layers);
  }

  /**
   * Validates a configuration bundle for required layers and valid values.
   *
   * Checks include:
   * - All required layers are present
   * - Runtime settings are positive numbers
   * - Security sandbox mode is valid
   * - Provider and workflow defaults are set
   * - Production environment disallows destructive actions
   *
   * @param bundle - The bundle to validate
   * @returns Array of issue codes found (empty if valid)
   */
  public validateBundle(bundle: ConfigBundle): string[] {
    const issues: string[] = [];

    // Check for missing required layers
    for (const layerName of REQUIRED_LAYER_NAMES) {
      if (!(layerName in bundle.layers)) {
        issues.push(`config.missing_layer:${layerName}`);
      }
    }

    validateLayerSchema(bundle.layers.bootstrap, BOOTSTRAP_LAYER_SCHEMA, issues);
    validateLayerSchema(bundle.layers.gateways, GATEWAYS_LAYER_SCHEMA, issues);
    validateLayerSchema(bundle.layers.providers, PROVIDERS_LAYER_SCHEMA, issues);
    validateLayerSchema(bundle.layers.runtime, RUNTIME_LAYER_SCHEMA, issues);
    validateLayerSchema(bundle.layers.security, SECURITY_LAYER_SCHEMA, issues);
    validateLayerSchema(bundle.layers.workflows, WORKFLOWS_LAYER_SCHEMA, issues);

    const providers = isPlainObject(bundle.layers.providers) ? bundle.layers.providers : {};
    const security = isPlainObject(bundle.layers.security) ? bundle.layers.security : {};
    const modelRegistry = loadModelMetadataRegistry(bundle.configRoot, {
      ...this.sandboxPolicy,
      allowedRoots: [bundle.configRoot],
    });
    if (
      typeof providers.defaultProvider === "string" &&
      providers.defaultProvider.trim().length > 0 &&
      !(providers.defaultProvider in modelRegistry.providers)
    ) {
      issues.push("config.invalid_providers.defaultProviderRegistryRef");
    }
    if (
      typeof providers.defaultModelProfile === "string" &&
      providers.defaultModelProfile.trim().length > 0 &&
      !(providers.defaultModelProfile in modelRegistry.profiles)
    ) {
      issues.push("config.invalid_providers.defaultModelProfileRegistryRef");
    }
    if (
      typeof providers.defaultProvider === "string" &&
      providers.defaultProvider.trim().length > 0 &&
      typeof providers.defaultModelProfile === "string" &&
      providers.defaultModelProfile.trim().length > 0
    ) {
      const profile = modelRegistry.profiles[providers.defaultModelProfile];
      if (profile && profile.provider !== providers.defaultProvider) {
        issues.push("config.invalid_providers.defaultModelProfileProviderMismatch");
      }
    }

    // Production safety check: destructive actions must be explicitly disabled
    if (bundle.environment === "prod" && security.allowDestructiveActions !== false) {
      issues.push("config.prod_destructive_actions_denied");
    }

    return issues;
  }

  /**
   * Lists available layer directory names in the config root.
   *
   * @param configRoot - Path to configuration root
   * @returns Sorted array of layer directory names
   */
  private listLayerNames(configRoot: string): string[] {
    return readdirSync(configRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(configRoot, entry.name, "default.json")))
      .map((entry) => entry.name)
      .sort();
  }

  private loadLayerConfig(
    configRoot: string,
    layerName: string,
    environment: string,
    effectivePolicy: SandboxPolicy,
  ): Record<string, unknown> {
    const defaultPath = join(configRoot, layerName, "default.json");
    const defaultCheck = checkSandboxPath(effectivePolicy, defaultPath);
    if (!defaultCheck.allowed) {
      throw new PolicyDeniedError(
        defaultCheck.reasonCode ?? "config.layer_denied",
        defaultCheck.reasonCode ?? "config.layer_denied",
      );
    }

    const base = parseJsonObject(readFileSync(defaultCheck.normalizedPath, "utf8"), defaultPath);
    const environmentPath = join(configRoot, layerName, `${environment}.json`);
    if (!existsSync(environmentPath)) {
      return base;
    }

    const environmentCheck = checkSandboxPath(effectivePolicy, environmentPath);
    if (!environmentCheck.allowed) {
      throw new PolicyDeniedError(
        environmentCheck.reasonCode ?? "config.environment_layer_denied",
        environmentCheck.reasonCode ?? "config.environment_layer_denied",
      );
    }

    const overlay = parseJsonObject(readFileSync(environmentCheck.normalizedPath, "utf8"), environmentPath);
    return mergeConfigObjects(base, overlay);
  }

  /**
   * Builds version metadata from layer hashes.
   *
   * Computes a deterministic bundle hash by sorting layer hashes
   * and hashing them together. The version ID is the first 16
   * characters of the bundle hash for convenience.
   *
   * @param layerHashes - Map of layer names to their content hashes
   * @returns Version information for the bundle
   */
  private buildVersion(layerHashes: Record<string, string>): ConfigVersion {
    const bundleHash = sha256(
      stableStringify(
        Object.entries(layerHashes)
          .sort(([left], [right]) => left.localeCompare(right))
          .reduce<Record<string, string>>((accumulator, [layerName, layerHash]) => {
            accumulator[layerName] = layerHash;
            return accumulator;
          }, {}),
      ),
    );

    return {
      versionId: bundleHash.slice(0, 16),
      bundleHash,
      layerHashes,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Parses and validates a JSON file into a plain object.
 *
 * @param raw - Raw JSON string content
 * @param filePath - Path to the file (for error reporting)
 * @returns Parsed object
 * @throws Error if JSON is invalid or root is not a plain object
 */
