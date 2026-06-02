/**
 * @fileoverview Plugin SDK - definePlugin DSL
 *
 * Implements §22.4 Plugin lifecycle: definePlugin() for plugin definition.
 */

import { createVerify, verify as verifyDetached } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ValidationError } from "../../platform/contracts/errors.js";
import { normalizeSandboxMode, type SandboxMode, type SandboxModeLike } from "../../platform/five-plane-control-plane/iam/sandbox-policy.js";

export type PluginType = "tool" | "adapter" | "retriever" | "evaluator" | "validator" | "planner" | "presenter";
export type PluginRole = "tool" | "adapter" | "retriever" | "evaluator" | "planner" | "presenter" | "validator";
export type PluginSigningAlgorithm =
  | "ed25519"
  | "ed448"
  | "RSA-SHA256"
  | "RSA-SHA384"
  | "RSA-SHA512"
  | "RS256"
  | "RS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | string;
export type SbomSeverity = "info" | "low" | "medium" | "high" | "critical";

/**
 * Represents a registered verification key for plugin signature verification.
 */
export interface PluginSigningVerificationKey {
  keyId: string;
  publicKeyPem: string;
  algorithm: PluginSigningAlgorithm;
}

export interface PluginSignatureVerificationResult {
  valid: boolean;
  verifiedAt: string;
  error?: string;
  keyId?: string;
  algorithm?: string;
}

export interface SbomVulnerability {
  id: string;
  severity: SbomSeverity;
  packageName: string;
  packageVersion: string;
  description: string;
}

export interface SbomVerificationOptions {
  minSeverity?: SbomSeverity;
}

export interface SbomVerificationResult {
  valid: boolean;
  scannedAt: string;
  vulnerabilities: SbomVulnerability[];
  scanErrors: string[];
}

export interface SbomScanner {
  scan(sbomRef: string, options?: SbomVerificationOptions): Promise<SbomVerificationResult>;
}

interface SynchronousSbomScanner extends SbomScanner {
  scanSync(sbomRef: string, options?: SbomVerificationOptions): SbomVerificationResult;
}

class PluginSigningKeyRegistry {
  constructor(private readonly keys: Map<string, PluginSigningVerificationKey>) {}

  registerKey(keyId: string, publicKeyPem: string, algorithm: PluginSigningAlgorithm = "ed25519"): void {
    const normalizedKeyId = keyId.trim();
    if (normalizedKeyId.length === 0) {
      throw new Error("Key ID must be non-empty");
    }
    const normalizedPublicKeyPem = publicKeyPem.trim();
    if (normalizedPublicKeyPem.length === 0) {
      throw new Error("Public key must be non-empty");
    }
    this.keys.set(normalizedKeyId, {
      keyId: normalizedKeyId,
      publicKeyPem: normalizedPublicKeyPem,
      algorithm,
    });
  }

  getKey(keyId: string): string | null {
    return this.keys.get(keyId.trim())?.publicKeyPem ?? null;
  }

  hasKey(keyId: string): boolean {
    return this.keys.has(keyId.trim());
  }

  removeKey(keyId: string): boolean {
    return this.keys.delete(keyId.trim());
  }

  clear(): void {
    this.keys.clear();
  }

  getVerificationKey(keyId: string): PluginSigningVerificationKey | null {
    return this.keys.get(keyId.trim()) ?? null;
  }
}

const pluginSigningVerificationKeys = new Map<string, PluginSigningVerificationKey>();
const signingKeyRegistry = new PluginSigningKeyRegistry(pluginSigningVerificationKeys);

export function getSigningKeyRegistry(): PluginSigningKeyRegistry {
  return signingKeyRegistry;
}

/**
 * Registers a public key used to verify plugin signatures.
 *
 * @param input - The verification key to register
 */
export function registerPluginSigningVerificationKey(input: PluginSigningVerificationKey): void {
  signingKeyRegistry.registerKey(input.keyId, input.publicKeyPem, input.algorithm);
}

const SEVERITY_ORDER: Record<SbomSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const DEFAULT_SBOM_VULNERABILITY_CATALOG: readonly SbomVulnerability[] = [
  {
    id: "CVE-2021-23337",
    severity: "high",
    packageName: "lodash",
    packageVersion: "4.17.21",
    description: "Command injection vulnerability in lodash template handling.",
  },
  {
    id: "CVE-2021-3749",
    severity: "high",
    packageName: "axios",
    packageVersion: "0.21.1",
    description: "SSRF vulnerability in axios proxy handling.",
  },
  {
    id: "CVE-2022-25883",
    severity: "high",
    packageName: "semver",
    packageVersion: "7.5.1",
    description: "Regular expression denial of service vulnerability in semver.",
  },
  {
    id: "CVE-2022-23529",
    severity: "critical",
    packageName: "jsonwebtoken",
    packageVersion: "8.5.1",
    description: "jsonwebtoken vulnerable to key confusion and signature verification bypass.",
  },
  {
    id: "CVE-2023-26136",
    severity: "high",
    packageName: "tough-cookie",
    packageVersion: "4.1.2",
    description: "Prototype pollution vulnerability in tough-cookie.",
  },
  {
    id: "CVE-2024-21538",
    severity: "high",
    packageName: "cross-spawn",
    packageVersion: "7.0.3",
    description: "Command injection vulnerability in cross-spawn argument escaping.",
  },
  {
    id: "CVE-2024-21534",
    severity: "high",
    packageName: "jsonpath-plus",
    packageVersion: "10.1.0",
    description: "Sandbox breakout vulnerability in jsonpath-plus evaluation.",
  },
  {
    id: "CVE-2024-4068",
    severity: "high",
    packageName: "micromatch",
    packageVersion: "4.0.7",
    description: "Denial of service vulnerability in micromatch pattern expansion.",
  },
];

let activeSbomVulnerabilityCatalog: readonly SbomVulnerability[] = DEFAULT_SBOM_VULNERABILITY_CATALOG;

const MAX_SBOM_BYTES = 1024 * 1024;

/**
 * Converts a plugin signing algorithm string to a Node.js crypto algorithm name.
 */
function nodeAlgorithm(algorithm: string): string {
  switch (algorithm.trim().toUpperCase()) {
    case "ED25519":
      return "ed25519";
    case "ED448":
      return "ed448";
    case "RSA-SHA256":
    case "RS256":
      return "RSA-SHA256";
    case "RSA-SHA384":
      return "RSA-SHA384";
    case "RSA-SHA512":
    case "RS512":
      return "RSA-SHA512";
    case "ES256":
      return "SHA256";
    case "ES384":
      return "SHA384";
    case "ES512":
      return "SHA512";
    default:
      throw new ValidationError(
        "plugin_sdk.unsupported_signing_algorithm",
        `Unsupported plugin signing algorithm: ${algorithm}`,
      );
  }
}

function decodeSignature(signature: string): Buffer | null {
  const normalized = signature.trim();
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(normalized)) {
    return null;
  }
  try {
    return Buffer.from(normalized, "base64url");
  } catch {
    return null;
  }
}

function buildPluginSigningPayload(definition: PluginDefinition): string {
  return JSON.stringify({
    pluginId: definition.pluginId,
    name: definition.name,
    version: definition.version,
    type: definition.type,
    capabilities: definition.capabilities,
    resourceLimits: definition.resourceLimits,
    dependencies: definition.dependencies,
    spiTypes: definition.spiTypes,
    domainIds: definition.domainIds,
  });
}

function verifySignatureForPayload(
  key: PluginSigningVerificationKey,
  algorithm: string,
  payload: string,
  signatureBytes: Buffer,
): boolean {
  if (algorithm === "ed25519" || algorithm === "ed448") {
    return verifyDetached(null, Buffer.from(payload), key.publicKeyPem, signatureBytes);
  }
  const verify = createVerify(algorithm);
  verify.update(payload);
  verify.end();
  return verify.verify(key.publicKeyPem, signatureBytes);
}

function verifyPluginSignatureDetailed(
  definition: PluginDefinition,
  canonicalPayload?: string,
): PluginSignatureVerificationResult {
  const verifiedAt = new Date().toISOString();
  if (!definition.signing) {
    return {
      valid: false,
      verifiedAt,
      error: "plugin_signature.not_signed",
    };
  }
  const key = signingKeyRegistry.getVerificationKey(definition.signing.keyId);
  if (!key) {
    return {
      valid: false,
      verifiedAt,
      error: "plugin_signature.unknown_key_id",
      keyId: definition.signing.keyId,
      algorithm: definition.signing.algorithm,
    };
  }
  const signatureBytes = decodeSignature(definition.signing.signature);
  if (!signatureBytes) {
    return {
      valid: false,
      verifiedAt,
      error: "plugin_signature.invalid_signature_format",
      keyId: definition.signing.keyId,
      algorithm: definition.signing.algorithm,
    };
  }
  try {
    const algorithm = nodeAlgorithm(definition.signing.algorithm || key.algorithm);
    const payload = canonicalPayload ?? buildPluginSigningPayload(definition);
    const matched = verifySignatureForPayload(key, algorithm, payload, signatureBytes);
    if (!matched) {
      return {
        valid: false,
        verifiedAt,
        error: "plugin_signature.verification_failed",
        keyId: definition.signing.keyId,
        algorithm: definition.signing.algorithm,
      };
    }
    return {
      valid: true,
      verifiedAt,
      keyId: definition.signing.keyId,
      algorithm: definition.signing.algorithm,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        valid: false,
        verifiedAt,
        error: error.code,
        keyId: definition.signing.keyId,
        algorithm: definition.signing.algorithm,
      };
    }
    return {
      valid: false,
      verifiedAt,
      error: `plugin_signature.verification_failed:${error instanceof Error ? error.message : "unknown"}`,
      keyId: definition.signing.keyId,
      algorithm: definition.signing.algorithm,
    };
  }
}

export function verifyPluginSignature(definition: PluginDefinition): boolean;
export function verifyPluginSignature(definition: PluginDefinition, canonicalPayload: string): PluginSignatureVerificationResult;
export function verifyPluginSignature(
  definition: PluginDefinition,
  canonicalPayload?: string,
): boolean | PluginSignatureVerificationResult {
  const result = verifyPluginSignatureDetailed(definition, canonicalPayload);
  if (canonicalPayload === undefined) {
    return result.valid;
  }
  return result;
}

/**
 * Enforces signature verification on a plugin definition.
 * Throws a ValidationError if the plugin has no signature or the signature is invalid.
 *
 * @param definition - The plugin definition to verify
 * @throws ValidationError if signature is missing or invalid
 */
export function enforcePluginSignature(definition: PluginDefinition): void {
  const result = verifyPluginSignatureDetailed(definition);
  if (!definition.signing) {
    throw new ValidationError(
      "plugin_sdk.missing_signature",
      "Plugin is not signed; signature is required for activation.",
      { details: { pluginId: definition.pluginId } },
    );
  }
  if (result.error === "plugin_signature.unknown_key_id") {
    throw new ValidationError(
      "plugin_sdk.unknown_signing_key",
      `Plugin signing keyId "${definition.signing.keyId}" is not registered for signature verification.`,
      { details: { pluginId: definition.pluginId, keyId: definition.signing.keyId } },
    );
  }
  if (result.error === "plugin_sdk.unsupported_signing_algorithm") {
    throw new ValidationError(
      "plugin_sdk.unsupported_signing_algorithm",
      `Unsupported plugin signing algorithm: ${definition.signing.algorithm}`,
      { details: { pluginId: definition.pluginId, algorithm: definition.signing.algorithm } },
    );
  }
  if (!result.valid) {
    throw new ValidationError(
      "plugin_sdk.invalid_signature",
      "Plugin signature verification failed; plugin may be tampered.",
      { details: { pluginId: definition.pluginId, reason: result.error } },
    );
  }
}

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
  sandboxTier?: SandboxModeLike;
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
  spiTypes: Array<PluginType | "planner" | "presenter" | "validator">;
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
  spiTypes?: PluginType[];
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

function minSeverity(severity: SbomSeverity | undefined): SbomSeverity {
  return severity ?? "low";
}

function normalizePackageRecords(document: unknown): Array<{ name: string; version: string }> {
  if (!document || typeof document !== "object") {
    return [];
  }
  const record = document as Record<string, unknown>;
  const fromCycloneDx = Array.isArray(record["components"])
    ? record["components"]
    : [];
  const fromSpdx = Array.isArray(record["packages"])
    ? record["packages"]
    : [];

  const normalized: Array<{ name: string; version: string }> = [];
  for (const entry of [...fromCycloneDx, ...fromSpdx]) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const packageRecord = entry as Record<string, unknown>;
    const name = typeof packageRecord["name"] === "string" ? packageRecord["name"].trim() : "";
    const version = typeof packageRecord["version"] === "string"
      ? packageRecord["version"].trim()
      : typeof packageRecord["versionInfo"] === "string"
        ? packageRecord["versionInfo"].trim()
        : "";
    if (name.length > 0 && version.length > 0) {
      normalized.push({ name, version });
    }
  }
  return normalized;
}

function filterVulnerabilities(
  packages: Array<{ name: string; version: string }>,
  threshold: SbomSeverity,
): SbomVulnerability[] {
  const minimum = SEVERITY_ORDER[threshold];
  return activeSbomVulnerabilityCatalog.filter((vulnerability) => {
    return SEVERITY_ORDER[vulnerability.severity] >= minimum
      && packages.some((pkg) => pkg.name === vulnerability.packageName && pkg.version === vulnerability.packageVersion);
  });
}

export function getSbomVulnerabilityCatalog(): readonly SbomVulnerability[] {
  return activeSbomVulnerabilityCatalog;
}

export function setSbomVulnerabilityCatalog(catalog: readonly SbomVulnerability[]): void {
  activeSbomVulnerabilityCatalog = catalog.map((entry) => ({
    id: entry.id,
    severity: entry.severity,
    packageName: entry.packageName,
    packageVersion: entry.packageVersion,
    description: entry.description,
  }));
}

export function resetSbomVulnerabilityCatalog(): void {
  activeSbomVulnerabilityCatalog = DEFAULT_SBOM_VULNERABILITY_CATALOG;
}

export class DefaultSbomScanner implements SbomScanner {
  scanSync(sbomRef: string, options: SbomVerificationOptions = {}): SbomVerificationResult {
    const scannedAt = new Date().toISOString();
    if (typeof sbomRef !== "string" || sbomRef.trim().length === 0) {
      return {
        valid: false,
        scannedAt,
        vulnerabilities: [],
        scanErrors: ["SBOM reference is required."],
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(sbomRef);
    } catch {
      return {
        valid: false,
        scannedAt,
        vulnerabilities: [],
        scanErrors: ["Invalid SBOM reference format."],
      };
    }

    if (!["file:"].includes(parsed.protocol)) {
      return {
        valid: false,
        scannedAt,
        vulnerabilities: [],
        scanErrors: [`Unsupported SBOM protocol: ${parsed.protocol}`],
      };
    }

    try {
      const sbomPath = fileURLToPath(parsed);
      const fileSize = statSync(sbomPath).size;
      if (!Number.isFinite(fileSize) || fileSize < 0 || fileSize > MAX_SBOM_BYTES) {
        return {
          valid: false,
          scannedAt,
          vulnerabilities: [],
          scanErrors: [`SBOM exceeds maximum supported size of ${MAX_SBOM_BYTES} bytes.`],
        };
      }
      const packages = normalizePackageRecords(JSON.parse(readFileSync(sbomPath, "utf8")));
      const vulnerabilities = filterVulnerabilities(packages, minSeverity(options.minSeverity));
      return {
        valid: vulnerabilities.length === 0,
        scannedAt,
        vulnerabilities,
        scanErrors: [],
      };
    } catch (error) {
      return {
        valid: false,
        scannedAt,
        vulnerabilities: [],
        scanErrors: [error instanceof Error ? error.message : "Failed to read SBOM content."],
      };
    }
  }

  async scan(sbomRef: string, options: SbomVerificationOptions = {}): Promise<SbomVerificationResult> {
    return this.scanSync(sbomRef, options);
  }
}

let activeSbomScanner: SbomScanner = new DefaultSbomScanner();

export function getSbomScanner(): SbomScanner {
  return activeSbomScanner;
}

export function setSbomScanner(scanner: SbomScanner): void {
  activeSbomScanner = scanner;
}

export async function verifySbomRef(sbomRef: string | null | undefined): Promise<SbomVerificationResult> {
  if (typeof sbomRef !== "string" || sbomRef.trim().length === 0) {
    return {
      valid: true,
      scannedAt: new Date().toISOString(),
      vulnerabilities: [],
      scanErrors: [],
    };
  }
  return activeSbomScanner.scan(sbomRef.trim());
}

function verifySbomRefSync(sbomRef: string | null | undefined): SbomVerificationResult {
  if (typeof sbomRef !== "string" || sbomRef.trim().length === 0) {
    return {
      valid: true,
      scannedAt: new Date().toISOString(),
      vulnerabilities: [],
      scanErrors: [],
    };
  }
  const scanner = activeSbomScanner as Partial<SynchronousSbomScanner>;
  if (typeof scanner.scanSync !== "function") {
    return {
      valid: false,
      scannedAt: new Date().toISOString(),
      vulnerabilities: [],
      scanErrors: ["Synchronous SBOM verification is required during plugin definition."],
    };
  }
  return scanner.scanSync(sbomRef.trim());
}

function normalizeResourceLimits(resourceLimits: PluginResourceLimits | undefined): PluginResourceLimits {
  const normalized = resourceLimits ?? DEFAULT_RESOURCE_LIMITS;
  for (const [key, value] of Object.entries(normalized)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new ValidationError(
        "plugin_sdk.invalid_resource_limits",
        `Plugin resource limit "${key}" must be a positive finite number.`,
      );
    }
  }
  return normalized;
}

function normalizeSecurityConfig(security: PluginSecurityInput | PluginSecurityConfig | undefined): PluginSecurityConfig {
  const requestedSandboxTier = security?.sandboxTier;
  if (typeof requestedSandboxTier === "string" && requestedSandboxTier.trim().toLowerCase() === "none") {
    throw new ValidationError(
      "plugin_sdk.insecure_sandbox_tier",
      "Plugin security sandboxTier 'none' is forbidden; use an explicit constrained sandbox tier instead.",
    );
  }

  return {
    sandboxTier: normalizeSandboxMode(requestedSandboxTier ?? DEFAULT_SECURITY.sandboxTier),
    egressDomains: security?.egressDomains ?? DEFAULT_SECURITY.egressDomains,
  };
}

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
export function definePlugin(options: DefinePluginOptions): PluginDefinition {
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
    resourceLimits: normalizeResourceLimits(options.resourceLimits),
    dependencies: options.dependencies ?? [],
    security: normalizeSecurityConfig(options.security),
    spiTypes: [...new Set((options.spiTypes ?? [options.type]).filter((type): type is PluginType => type !== undefined))],
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
  if (result.signing) {
    enforcePluginSignature(result);
  }
  if (result.sbomRef) {
    const sbomResult = verifySbomRefSync(result.sbomRef);
    const blockingFindings = sbomResult.vulnerabilities.filter((vulnerability) => SEVERITY_ORDER[vulnerability.severity] >= SEVERITY_ORDER["high"]);
    if (sbomResult.scanErrors.length > 0) {
      throw new ValidationError(
        "plugin_sdk.sbom_verification_required",
        sbomResult.scanErrors.join("; "),
        { details: { pluginId: result.pluginId } },
      );
    }
    if (blockingFindings.length > 0) {
      throw new ValidationError(
        "plugin_sdk.sbom_critical_vulnerabilities",
        "Plugin SBOM contains high or critical vulnerabilities.",
        {
          details: {
            pluginId: result.pluginId,
            vulnerabilities: blockingFindings.map((finding) => finding.id),
          },
        },
      );
    }
  }
  return result;
}

/**
 * Define a tool plugin (convenience function).
 */
export function defineTool(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "tool" });
}

/**
 * Define an adapter plugin (convenience function).
 */
export function defineAdapter(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "adapter" });
}

/**
 * Define a retriever plugin (convenience function).
 */
export function defineRetriever(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "retriever" });
}

/**
 * Define an evaluator plugin (convenience function).
 */
export function defineEvaluator(options: Omit<DefinePluginOptions, "type"> & { pluginId: string; name: string; version: string }): PluginDefinition {
  return definePlugin({ ...options, type: "evaluator" });
}

/**
 * Validate a plugin manifest.
 */
export function validatePluginDefinition(definition: PluginDefinition): PluginDefinition {
  const validTypes: PluginType[] = ["tool", "adapter", "retriever", "evaluator", "validator", "planner", "presenter"];
  const validated = definePlugin({
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
    spiTypes: (definition.spiTypes ?? [definition.type]).filter((type): type is PluginType => {
      return typeof type === "string" && validTypes.includes(type as PluginType);
    }),
    domainIds: definition.domainIds ?? [],
    sbomRef: definition.sbomRef,
    signing: definition.signing,
  });
  if (validated.signing) {
    enforcePluginSignature(validated);
  }
  return validated;
}
