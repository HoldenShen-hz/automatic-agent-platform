/**
 * @fileoverview Plugin SDK - definePlugin DSL
 *
 * Implements §22.4 Plugin lifecycle: definePlugin() for plugin definition.
 */

import { createHmac, createVerify, createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ValidationError } from "../../platform/contracts/errors.js";
import { normalizeSandboxMode, type SandboxMode } from "../../platform/control-plane/iam/sandbox-policy.js";

/**
 * Registry for plugin signing public keys.
 * Maps keyId -> PEM-encoded public key.
 */
class PluginSigningKeyRegistry {
  private readonly keys = new Map<string, string>();

  /**
   * Register a public key for signature verification.
   */
  registerKey(keyId: string, publicKeyPem: string): void {
    if (!keyId?.trim()) {
      throw new ValidationError("plugin_sdk.invalid_key_id", "Key ID must be non-empty.");
    }
    if (!publicKeyPem?.trim()) {
      throw new ValidationError("plugin_sdk.invalid_public_key", "Public key must be non-empty.");
    }
    this.keys.set(keyId.trim(), publicKeyPem.trim());
  }

  /**
   * Get a registered public key by keyId.
   */
  getKey(keyId: string): string | null {
    return this.keys.get(keyId) ?? null;
  }

  /**
   * Check if a keyId is registered.
   */
  hasKey(keyId: string): boolean {
    return this.keys.has(keyId);
  }

  /**
   * Remove a registered key.
   */
  removeKey(keyId: string): boolean {
    return this.keys.delete(keyId);
  }

  /**
   * Clear all registered keys.
   */
  clear(): void {
    this.keys.clear();
  }
}

// Global registry instance
const globalSigningKeyRegistry = new PluginSigningKeyRegistry();

/**
 * Get the global signing key registry.
 * Use this to register public keys for plugin signature verification.
 */
export function getSigningKeyRegistry(): PluginSigningKeyRegistry {
  return globalSigningKeyRegistry;
}

/**
 * Result of plugin signature verification.
 */
export interface PluginSignatureVerificationResult {
  readonly valid: boolean;
  readonly error?: string;
}

/**
 * Result of SBOM verification and security scan.
 */
export interface SbomVerificationResult {
  readonly valid: boolean;
  readonly scannedAt: string;
  readonly vulnerabilities: readonly SbomVulnerability[];
  readonly scanErrors: readonly string[];
}

/**
 * Security vulnerability detected in a plugin.
 */
export interface SbomVulnerability {
  readonly id: string;
  readonly severity: "critical" | "high" | "medium" | "low" | "info";
  readonly packageName: string;
  readonly packageVersion: string;
  readonly description: string;
  readonly fixedVersion?: string;
  readonly cveId?: string;
}

/**
 * §22.4: SbomScanner - Interface for security scanning of SBOM references.
 * Implementations can use different backends (native, API-based, etc.)
 */
export interface SbomScanner {
  /**
   * Fetch and scan an SBOM from a reference URL or path.
   * @param sbomRef - URI reference to the SBOM (https://, file://, etc.)
   * @param options - Scan options including severity threshold
   * @returns Verification result with any vulnerabilities found
   */
  scan(sbomRef: string, options?: { minSeverity?: "critical" | "high" | "medium" | "low" | "info" }): Promise<SbomVerificationResult>;
}

/**
 * Default SBOM scanner using a simple vulnerability database lookup.
 * In production, this would integrate with a real security scanning service.
 */
export class DefaultSbomScanner implements SbomScanner {
  private readonly severityOrder = ["critical", "high", "medium", "low", "info"];

  async scan(
    sbomRef: string,
    options?: { minSeverity?: "critical" | "high" | "medium" | "low" | "info" },
  ): Promise<SbomVerificationResult> {
    const vulnerabilities: SbomVulnerability[] = [];
    const scanErrors: string[] = [];

    // §22.4: Validate sbomRef format
    if (!this.isValidSbomRef(sbomRef)) {
      return {
        valid: false,
        scannedAt: new Date().toISOString(),
        vulnerabilities: [],
        scanErrors: [`Invalid SBOM reference format: ${sbomRef}`],
      };
    }

    let sbom: { packages: Array<{ name: string; version: string }> };
    try {
      sbom = await this.fetchSbom(sbomRef);
    } catch (error) {
      return {
        valid: false,
        scannedAt: new Date().toISOString(),
        vulnerabilities: [],
        scanErrors: [error instanceof Error ? error.message : `Failed to fetch SBOM from ${sbomRef}`],
      };
    }

    // Check for known vulnerable packages
    for (const pkg of sbom.packages ?? []) {
      const vulns = this.checkVulnerabilities(pkg.name, pkg.version);
      for (const vuln of vulns) {
        if (this.shouldReportVuln(vuln, options?.minSeverity)) {
          vulnerabilities.push(vuln);
        }
      }
    }

    return {
      valid: vulnerabilities.filter((v) => v.severity === "critical" || v.severity === "high").length === 0,
      scannedAt: new Date().toISOString(),
      vulnerabilities,
      scanErrors: [],
    };
  }

  /**
   * Validate SBOM reference format.
   */
  private isValidSbomRef(sbomRef: string): boolean {
    if (!sbomRef?.trim()) return false;
    try {
      const url = new URL(sbomRef);
      return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "file:";
    } catch {
      return false;
    }
  }

  /**
   * Fetch SBOM content from reference.
   * Supports SPDX and CycloneDX JSON documents from file:// and http(s):// sources.
   */
  private async fetchSbom(sbomRef: string): Promise<{ packages: Array<{ name: string; version: string }> }> {
    const url = new URL(sbomRef);
    let rawSbom = "";

    if (url.protocol === "file:") {
      rawSbom = await readFile(fileURLToPath(url), "utf8");
    } else if (url.protocol === "http:" || url.protocol === "https:") {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch SBOM from ${sbomRef}: HTTP ${response.status}`);
      }
      rawSbom = await response.text();
    } else {
      throw new Error(`Unsupported SBOM protocol: ${url.protocol}`);
    }

    return this.parseSbom(rawSbom, sbomRef);
  }

  private parseSbom(
    rawSbom: string,
    sbomRef: string,
  ): { packages: Array<{ name: string; version: string }> } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawSbom);
    } catch {
      throw new Error(`Failed to parse SBOM from ${sbomRef}: content is not valid JSON`);
    }

    const packages = this.extractPackages(parsed);
    if (packages == null) {
      throw new Error(`Failed to parse SBOM from ${sbomRef}: unsupported SBOM shape`);
    }

    return { packages };
  }

  private extractPackages(value: unknown): Array<{ name: string; version: string }> | null {
    if (!isRecord(value)) {
      return null;
    }

    if (Array.isArray(value.packages)) {
      return value.packages.flatMap((pkg) => this.normalizePackageRecord(pkg, ["name", "packageName"], ["version", "versionInfo"]));
    }

    if (Array.isArray(value.components)) {
      return value.components.flatMap((component) => this.normalizePackageRecord(component, ["name"], ["version"]));
    }

    return null;
  }

  private normalizePackageRecord(
    candidate: unknown,
    nameKeys: readonly string[],
    versionKeys: readonly string[],
  ): Array<{ name: string; version: string }> {
    if (!isRecord(candidate)) {
      return [];
    }

    const name = this.readFirstString(candidate, nameKeys);
    const version = this.readFirstString(candidate, versionKeys);
    if (name == null || version == null) {
      return [];
    }

    return [{ name, version }];
  }

  private readFirstString(record: Record<string, unknown>, keys: readonly string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }

  /**
   * Check a package against known vulnerability database.
   * In production this would query a real vulnerability database.
   */
  private checkVulnerabilities(packageName: string, packageVersion: string): SbomVulnerability[] {
    // Simulated vulnerability database - in production this would be a real DB lookup
    // Example: known vulnerabilities in common packages
    const knownVulns: Record<string, SbomVulnerability[]> = {
      "lodash": [{
        id: "CVE-2021-23337",
        severity: "high",
        packageName: "lodash",
        packageVersion: "4.17.21",
        description: "Command injection via template string",
        fixedVersion: "4.17.22",
        cveId: "CVE-2021-23337",
      }],
      "axios": [{
        id: "CVE-2021-3749",
        severity: "high",
        packageName: "axios",
        packageVersion: "0.21.1",
        description: "Server-Side Request Forgery",
        fixedVersion: "0.21.2",
        cveId: "CVE-2021-3749",
      }],
    };

    return knownVulns[packageName]?.filter((v) => v.packageVersion === packageVersion) ?? [];
  }

  /**
   * Determine if a vulnerability should be reported based on severity threshold.
   */
  private shouldReportVuln(vuln: SbomVulnerability, minSeverity?: "critical" | "high" | "medium" | "low" | "info"): boolean {
    if (!minSeverity) return true;
    const vulnIndex = this.severityOrder.indexOf(vuln.severity);
    const minIndex = this.severityOrder.indexOf(minSeverity);
    return vulnIndex <= minIndex;
  }
}

// Global SBOM scanner instance
let globalSbomScanner: SbomScanner = new DefaultSbomScanner();

/**
 * Get the global SBOM scanner instance.
 */
export function getSbomScanner(): SbomScanner {
  return globalSbomScanner;
}

/**
 * Set a custom SBOM scanner (for testing or alternative implementations).
 */
export function setSbomScanner(scanner: SbomScanner): void {
  globalSbomScanner = scanner;
}

/**
 * Verify an SBOM reference and scan for security vulnerabilities.
 * Returns verification result with any vulnerabilities found.
 */
export async function verifySbomRef(sbomRef: string | null): Promise<SbomVerificationResult> {
  if (!sbomRef) {
    return {
      valid: true,
      scannedAt: new Date().toISOString(),
      vulnerabilities: [],
      scanErrors: [],
    };
  }

  return globalSbomScanner.scan(sbomRef);
}

/**
 * Verify a plugin definition's signature against its canonical representation.
 * Uses the public key registered for the given keyId.
 *
 * @param definition - The plugin definition with signing info
 * @param canonicalString - The canonical string that was signed (typically JSON canonicalized definition)
 * @returns Verification result with validity and error message if invalid
 */
export function verifyPluginSignature(
  definition: PluginDefinition,
  canonicalString: string,
): PluginSignatureVerificationResult {
  // If no signing info, plugin is not signed
  if (!definition.signing) {
    return { valid: false, error: "plugin_sdk.not_signed" };
  }

  const { keyId, signature, algorithm } = definition.signing;

  // Get the public key from registry
  const publicKeyPem = globalSigningKeyRegistry.getKey(keyId);
  if (!publicKeyPem) {
    return { valid: false, error: `plugin_sdk.unknown_key_id: ${keyId}` };
  }

  try {
    const publicKey = createPublicKey({ key: publicKeyPem, format: "pem" });
    const sigBuffer = Buffer.from(signature, "base64url");
    const isValid = verifySignatureBuffer(algorithm, canonicalString, publicKey, sigBuffer);

    return isValid ? { valid: true } : { valid: false, error: "plugin_sdk.signature_invalid" };
  } catch (err) {
    return {
      valid: false,
      error: `plugin_sdk.verification_failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function verifySignatureBuffer(
  algorithm: string,
  canonicalString: string,
  publicKey: ReturnType<typeof createPublicKey>,
  signature: Buffer,
): boolean {
  const normalizedAlgorithm = algorithm.trim().toLowerCase();
  if (normalizedAlgorithm === "ed25519" || normalizedAlgorithm === "ed448") {
    return verifySignature(null, Buffer.from(canonicalString), publicKey, signature);
  }

  const nodeAlg = algorithmToNodeAlg(algorithm);
  const verifier = createVerify(nodeAlg);
  verifier.update(canonicalString);
  verifier.end();
  return verifier.verify(publicKey, signature);
}

/**
 * Map algorithm name to Node.js crypto algorithm string.
 */
function algorithmToNodeAlg(alg: string): string {
  switch (alg) {
    case "ed25519":
      return "ed25519";
    case "ed448":
      return "ed448";
    case "rs256":
    case "RS256":
      return "RSA-SHA256";
    case "rs384":
    case "RS384":
      return "RSA-SHA384";
    case "rs512":
    case "RS512":
      return "RSA-SHA512";
    case "es256":
    case "ES256":
      return "SHA256"; // Node.js ECDSA verify uses "SHA*" for ES256
    case "es384":
    case "ES384":
      return "SHA384";
    case "es512":
    case "ES512":
      return "SHA512";
    default:
      // Default to ed25519 for unknown algorithms (common for plugin signatures)
      return "ed25519";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export type PluginType = "tool" | "adapter" | "retriever" | "evaluator";
export type PluginRole = "tool" | "adapter" | "retriever" | "evaluator" | "planner" | "presenter" | "validator";

/**
 * PluginSpiType - All valid SPI types per plugin-spi contract §4
 * Union of PluginType plus extended SPI roles (planner, presenter, validator).
 */
export type PluginSpiType = PluginType | "planner" | "presenter" | "validator";

export interface PluginCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface PluginResourceLimits {
  maxMemoryMb: number;
  maxCpuMs: number;
  maxDurationMs: number;
}

export interface PluginSecurityConfig {
  sandboxTier: SandboxMode;
  egressDomains: string[];
}

export interface PluginSecurityInput {
  sandboxTier?: string;
  egressDomains?: string[];
}

export interface PluginDefinition {
  pluginId: string;
  name: string;
  version: string;
  type: PluginType;
  role?: PluginRole;
  description?: string;
  capabilities: PluginCapability[];
  resourceLimits: PluginResourceLimits;
  dependencies: string[];
  security: PluginSecurityConfig;
  /** SPI types must be compatible with PluginSpiType from plugin-spi contract §4 */
  spiTypes: PluginSpiType[];
  domainIds: string[];
  sbomRef: string | null;
  signing: {
    keyId: string;
    signature: string;
    algorithm: string;
  } | null;
}

export interface DefinePluginOptions {
  pluginId?: string;
  name?: string;
  version?: string;
  type?: PluginType;
  role?: PluginRole;
  description?: string;
  capabilities?: PluginCapability[];
  resourceLimits?: PluginResourceLimits;
  dependencies?: string[];
  security?: PluginSecurityInput;
  /** SPI types must be compatible with PluginSpiType from plugin-spi contract §4 */
  spiTypes?: PluginSpiType[];
  domainIds?: string[];
  sbomRef?: string | null;
  signing?: {
    keyId: string;
    signature: string;
    algorithm?: string;
  } | null;
}

const DEFAULT_RESOURCE_LIMITS: PluginResourceLimits = {
  maxMemoryMb: 512,
  maxCpuMs: 5000,
  maxDurationMs: 30000,
};

const DEFAULT_SECURITY: PluginSecurityConfig = {
  sandboxTier: "read_only",
  egressDomains: [],
};

/**
 * Define a plugin using the Plugin SDK DSL.
 *
 * @example
 * ```typescript
 * const myTool = definePlugin({
 *   pluginId: "my-pack.query-tool",
 *   name: "Query Tool",
 *   version: "1.0.0",
 *   type: "tool",
 *   capabilities: [{
 *     name: "execute",
 *     description: "Execute a query",
 *     inputSchema: { type: "object", properties: { query: { type: "string" } } },
 *     outputSchema: { type: "object", properties: { result: { type: "string" } } },
 *   }],
 * });
 * ```
 */
export async function definePlugin(options: DefinePluginOptions): Promise<PluginDefinition> {
  if (!options.pluginId?.trim()) {
    throw new ValidationError("plugin_sdk.missing_plugin_id", "Plugin ID is required (plugin_sdk.missing_plugin_id).");
  }
  if (!options.name?.trim()) {
    throw new ValidationError("plugin_sdk.missing_name", "Plugin name is required.");
  }
  if (!options.version?.trim()) {
    throw new ValidationError("plugin_sdk.missing_version", "Plugin version is required.");
  }
  if (!options.type) {
    throw new ValidationError("plugin_sdk.missing_type", "Plugin type is required.");
  }
  if (!options.capabilities || options.capabilities.length === 0) {
    throw new ValidationError("plugin_sdk.empty_capabilities", "Plugin must declare at least one capability (plugin_sdk.empty_capabilities).");
  }

  for (const cap of options.capabilities) {
    if (!cap.name?.trim()) {
      throw new ValidationError("plugin_sdk.invalid_capability_name", "Capability name is required.");
    }
    if (!cap.inputSchema) {
      throw new ValidationError("plugin_sdk.missing_input_schema", `Capability ${cap.name} requires inputSchema.`);
    }
    if (!cap.outputSchema) {
      throw new ValidationError("plugin_sdk.missing_output_schema", `Capability ${cap.name} requires outputSchema.`);
    }
  }

  const result: PluginDefinition = {
    pluginId: options.pluginId.trim(),
    name: options.name.trim(),
    version: options.version.trim(),
    type: options.type,
    ...(options.role !== undefined ? { role: options.role } : {}),
    capabilities: options.capabilities,
    resourceLimits: options.resourceLimits ?? DEFAULT_RESOURCE_LIMITS,
    dependencies: options.dependencies ?? [],
    security: {
      sandboxTier: normalizeSandboxMode(options.security?.sandboxTier ?? DEFAULT_SECURITY.sandboxTier),
      egressDomains: options.security?.egressDomains ?? DEFAULT_SECURITY.egressDomains,
    },
    spiTypes: [...new Set((options.spiTypes ?? [options.type]).filter((type): type is PluginSpiType => type !== undefined))],
    domainIds: [...new Set((options.domainIds ?? []).map((domainId) => domainId.trim()).filter((domainId) => domainId.length > 0))],
    sbomRef: options.sbomRef?.trim() ? options.sbomRef.trim() : null,
    signing: options.signing == null ? null : {
      keyId: options.signing.keyId.trim(),
      signature: options.signing.signature.trim(),
      algorithm: options.signing.algorithm?.trim() || "ed25519",
    },
  };
  if (options.description?.trim()) {
    result.description = options.description.trim();
  }

  // §4/R21-30: Verify plugin signature cryptographically if signing info is present.
  // The signature must be validated before the plugin is considered valid.
  // If signing is present but verification fails, the plugin must be rejected.
  // Root cause: Previously, plugins without signing info passed through without
  // verification. Per spec, SIGNING IS MANDATORY - no signing = rejection.
  if (result.signing == null) {
    throw new ValidationError(
      "plugin_sdk.signature_required",
      "Plugin signature is required per security policy - unsigned plugins are not allowed",
      { details: { pluginId: result.pluginId } },
    );
  }
  const canonicalJson = JSON.stringify({
    pluginId: result.pluginId,
    name: result.name,
    version: result.version,
    type: result.type,
    capabilities: result.capabilities,
    spiTypes: result.spiTypes,
    domainIds: result.domainIds,
  });
  const verification = verifyPluginSignature(result, canonicalJson);
  if (!verification.valid) {
    throw new ValidationError(
      "plugin_sdk.signature_verification_failed",
      `Plugin signature verification failed: ${verification.error}`,
      { details: { pluginId: result.pluginId, keyId: result.signing.keyId } },
    );
  }

  // §22.4/R21-46: Verify SBOM reference if present.
  // The SBOM must be scanned for security vulnerabilities before the plugin is loaded.
  // If sbomRef is present but scan fails or reveals critical/high vulnerabilities, reject.
  if (result.sbomRef != null) {
    const sbomVerification = await verifySbomRef(result.sbomRef);
    if (sbomVerification.scanErrors.length > 0) {
      throw new ValidationError(
        "plugin_sdk.sbom_verification_failed",
        `SBOM verification failed: ${sbomVerification.scanErrors.join("; ")}`,
        { details: { pluginId: result.pluginId, sbomRef: result.sbomRef } },
      );
    }
    const criticalVulns = sbomVerification.vulnerabilities.filter((v) => v.severity === "critical" || v.severity === "high");
    if (criticalVulns.length > 0) {
      throw new ValidationError(
        "plugin_sdk.sbom_critical_vulnerabilities",
        `SBOM contains critical/high vulnerabilities: ${criticalVulns.map((v) => v.id).join(", ")}`,
        { details: { pluginId: result.pluginId, sbomRef: result.sbomRef, vulnerabilities: criticalVulns } },
      );
    }
    if (!sbomVerification.valid) {
      throw new ValidationError(
        "plugin_sdk.sbom_verification_failed",
        "SBOM verification failed without detailed scan errors",
        { details: { pluginId: result.pluginId, sbomRef: result.sbomRef } },
      );
    }
  }

  return result;
}

/**
 * Define a tool plugin (convenience function).
 */
export function defineTool(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): Promise<PluginDefinition> {
  return definePlugin({ ...options, type: "tool" });
}

/**
 * Define an adapter plugin (convenience function).
 */
export function defineAdapter(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): Promise<PluginDefinition> {
  return definePlugin({ ...options, type: "adapter" });
}

/**
 * Define a retriever plugin (convenience function).
 */
export function defineRetriever(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): Promise<PluginDefinition> {
  return definePlugin({ ...options, type: "retriever" });
}

/**
 * Define an evaluator plugin (convenience function).
 */
export function defineEvaluator(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): Promise<PluginDefinition> {
  return definePlugin({ ...options, type: "evaluator" });
}

/**
 * Validate a plugin manifest.
 */
export async function validatePluginDefinition(definition: PluginDefinition): Promise<PluginDefinition> {
  return definePlugin({
    pluginId: definition.pluginId,
    name: definition.name,
    version: definition.version,
    type: definition.type,
    ...(definition.role !== undefined ? { role: definition.role } : {}),
    description: definition.description ?? "Plugin description",
    capabilities: definition.capabilities,
    resourceLimits: definition.resourceLimits,
    dependencies: definition.dependencies,
    security: definition.security,
    spiTypes: definition.spiTypes,
    domainIds: definition.domainIds,
    sbomRef: definition.sbomRef,
    signing: definition.signing,
  });
}
