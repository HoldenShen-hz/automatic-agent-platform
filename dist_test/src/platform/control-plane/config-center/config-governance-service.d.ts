/**
 * Config Governance Service
 */
export * from "./config-governance-support.js";
import { type ConfigBundle, type ConfigDiffEntry, type ConfigGovernanceServiceOptions } from "./config-governance-support.js";
export declare class ConfigGovernanceService {
    private readonly configRoot;
    private readonly sandboxPolicy;
    /**
     * Creates a new ConfigGovernanceService.
     *
     * @param options - Configuration options (all optional)
     * @param options.configRoot - Override default config root path
     * @param options.sandboxPolicy - Override default sandbox policy
     */
    constructor(options?: ConfigGovernanceServiceOptions);
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
    loadBundle(environment?: string): ConfigBundle;
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
    detectTampering(expectedVersionId: string, environment?: string): {
        tampered: boolean;
        currentVersion: string;
        issues: string[];
    };
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
    diffBundles(before: ConfigBundle, after: ConfigBundle): ConfigDiffEntry[];
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
    validateBundle(bundle: ConfigBundle): string[];
    /**
     * Lists available layer directory names in the config root.
     *
     * @param configRoot - Path to configuration root
     * @returns Sorted array of layer directory names
     */
    private listLayerNames;
    private loadLayerConfig;
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
    private buildVersion;
}
/**
 * Parses and validates a JSON file into a plain object.
 *
 * @param raw - Raw JSON string content
 * @param filePath - Path to the file (for error reporting)
 * @returns Parsed object
 * @throws Error if JSON is invalid or root is not a plain object
 */
