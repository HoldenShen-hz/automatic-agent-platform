import { createHash, createSign, createVerify, generateKeyPairSync } from "node:crypto";
import { ValidationError } from "../../platform/contracts/errors.js";

export interface PackCapabilityProfile {
  maturity: "experimental" | "beta" | "ga";
  requiredContracts: string[];
  supportedPluginTypes?: Array<"tool" | "adapter" | "retriever" | "evaluator">;
  evaluationMode?: "offline" | "online" | "hybrid";
}

export interface BusinessPackCapability {
  capabilityKey: string;
  maturity?: "experimental" | "beta" | "ga";
  requiredContracts?: string[];
  profile?: PackCapabilityProfile;
}

export interface BusinessPackManifest {
  packId: string;
  version: string;
  domainId: string;
  domain?: string;
  owner: string;
  capabilities: BusinessPackCapability[];
  sideEffects?: string[];
  dataClasses?: string[];
  maxRiskClass?: "low" | "medium" | "high" | "critical";
  tools?: string[];
  connectors?: string[];
  plugins?: string[];
  evalRequirements?: {
    requiredDatasets: string[];
    blockingEvaluators: string[];
    acceptanceThresholds?: Record<string, number>;
  };
  compatibility?: {
    minPlatformVersion?: string;
    supportedDomainSpecVersions?: string[];
    requiresActiveDomain?: boolean;
  };
  sdk_semver?: string;
  platform_min_version?: string;
  platform_max_version?: string;
  contract_test_generator?: string;
  deprecation_policy?: SdkReleaseDescriptor;
}

export interface SdkReleaseDescriptor {
  sdk_semver: string;
  platform_min_version: string;
  platform_max_version: string;
  deprecation_policy: "notify_only" | "block" | "migration_required" | "hard_cutoff";
}

// ── Security Scanning ─────────────────────────────────────────────────

/**
 * Result of a security scan on a pack artifact.
 */
export interface SecurityScanResult {
  /** Whether the scan passed all security checks */
  passed: boolean;
  /** List of security issues found */
  issues: SecurityIssue[];
  /** Timestamp when the scan was performed */
  scannedAt: string;
  /** SHA-256 hash of the scanned artifact */
  artifactHash: string;
}

/**
 * A security issue found during scanning.
 */
export interface SecurityIssue {
  /** Severity level of the issue */
  severity: "info" | "warning" | "critical";
  /** Unique code for this issue type */
  code: string;
  /** Human-readable description */
  message: string;
  /** Optional evidence or details about the issue */
  evidence?: string;
}

/**
 * Patterns that indicate potentially malicious code.
 * These are heuristic checks - not a substitute for a full security analysis tool.
 */
const MALICIOUS_CODE_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /eval\s*\(\s*(?:req|request|input|body|params|headers)(?:\s*\.\s*\w+)*\s*\)/gi, code: "PACK_SCAN_DYNAMIC_CODE_EXEC", message: "Potentially dangerous dynamic code execution using user input" },
  { pattern: /Function\s*\(\s*(?:req|request|input|body|params)(?:\s*\.\s*\w+)*\s*\)/gi, code: "PACK_SCAN_DYNAMIC_FUNCTION", message: "Potentially dangerous Function constructor with user input" },
  { pattern: /child_process|exec\s*\(|spawn\s*\(|fork\s*\(/gi, code: "PACK_SCAN_SHELL_EXEC", message: "Potential shell command execution detected" },
  { pattern: /process\.env\.(?:HOME|USER|PATH|SHELL)/gi, code: "PACK_SCAN_ENV_ACCESS", message: "Access to sensitive environment variables detected" },
  { pattern: /__dirname|__filename/gi, code: "PACK_SCAN_FILESYSTEM_BOUNDARY", message: "Filesystem path introspection detected" },
];

/**
 * Scans pack source code for security issues.
 *
 * @param sourceCode - The pack source code to scan
 * @param artifactHash - SHA-256 hash of the artifact being scanned
 * @returns Security scan result with any issues found
 */
export function scanPackSecurity(
  sourceCode: string,
  artifactHash: string,
): SecurityScanResult {
  const issues: SecurityIssue[] = [];

  for (const { pattern, code, message } of MALICIOUS_CODE_PATTERNS) {
    const matches = sourceCode.match(pattern);
    if (matches) {
      // Truncate evidence to first 3 matches to avoid huge error messages
      const evidence = matches.length > 3
        ? `Found ${matches.length} occurrences. Examples: ${matches.slice(0, 3).join(", ")}`
        : `Found ${matches.length} occurrence(s): ${matches.join(", ")}`;

      issues.push({
        severity: (code === "PACK_SCAN_SHELL_EXEC" || code === "PACK_SCAN_DYNAMIC_CODE_EXEC") ? "critical" : "warning",
        code,
        message,
        evidence,
      });
    }
  }

  return {
    passed: issues.filter(i => i.severity === "critical").length === 0,
    issues,
    scannedAt: new Date().toISOString(),
    artifactHash,
  };
}

// ── Artifact Signing ─────────────────────────────────────────────────

/**
 * Represents a cryptographic signature for a pack artifact.
 */
export interface PackArtifactSignature {
  /** The packId this signature is for */
  packId: string;
  /** Version of the pack being signed */
  version: string;
  /** Base64-encoded signature */
  signature: string;
  /** Algorithm used for signing */
  algorithm: "RSA-SHA256" | "RSA-SHA384" | "RSA-SHA512";
  /** Public key fingerprint (SHA-256 of the public key in SPKI format) */
  keyFingerprint: string;
  /** When the signature was created */
  signedAt: string;
}

/**
 * Signs a pack manifest to create a verifiable artifact signature.
 *
 * @param manifest - The pack manifest to sign
 * @param privateKeyPem - PEM-encoded RSA private key
 * @param algorithm - Signing algorithm to use (default: RSA-SHA256)
 * @returns Pack artifact signature
 */
export function signPackArtifact(
  manifest: BusinessPackManifest,
  privateKeyPem: string,
  algorithm: "RSA-SHA256" | "RSA-SHA384" | "RSA-SHA512" = "RSA-SHA256",
): PackArtifactSignature {
  const sign = createSign(algorithm);
  sign.update(JSON.stringify(manifest));

  const signature = sign.sign(privateKeyPem, "base64");

  // Generate key fingerprint from the private key
  const hash = createHash("sha256");
  hash.update(privateKeyPem);
  const keyFingerprint = hash.digest("hex").substring(0, 16);

  return {
    packId: manifest.packId,
    version: manifest.version,
    signature,
    algorithm,
    keyFingerprint,
    signedAt: new Date().toISOString(),
  };
}

/**
 * Verifies a pack manifest against its signature.
 *
 * @param manifest - The pack manifest to verify
 * @param signature - The signature to verify against
 * @param publicKeyPem - PEM-encoded RSA public key (or private key containing public key)
 * @returns True if the signature is valid, false otherwise
 */
export function verifyPackSignature(
  manifest: BusinessPackManifest,
  signature: PackArtifactSignature,
  publicKeyPem: string,
): boolean {
  if (manifest.packId !== signature.packId || manifest.version !== signature.version) {
    return false;
  }

  const verify = createVerify(signature.algorithm);
  verify.update(JSON.stringify(manifest));

  try {
    return verify.verify(publicKeyPem, signature.signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Generates a deterministic content hash for a pack artifact.
 *
 * @param content - The content to hash
 * @returns SHA-256 hash of the content in hex format
 */
export function generateArtifactHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Generates a random signing key pair for pack signing.
 * In production, keys should be managed by a secure KMS.
 *
 * @returns Object containing base64-encoded private and public keys
 */
export function generateSigningKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { privateKey, publicKey };
}

// ── Verification ─────────────────────────────────────────────────────

/**
 * Verification result for a pack artifact.
 */
export interface PackVerificationResult {
  /** Whether the pack passed all verification checks */
  valid: boolean;
  /** List of verification failures */
  failures: string[];
  /** Security scan result if scan was performed */
  securityScan: SecurityScanResult | undefined;
  /** Signature verification result */
  signatureValid: boolean | undefined;
}

export interface VerifyPackOptions {
  /** The pack manifest to verify */
  manifest: BusinessPackManifest;
  /** The pack source code (for security scanning) */
  sourceCode?: string;
  /** Expected signature (if pack should be signed) */
  signature?: PackArtifactSignature;
  /** Public key for signature verification (required if signature is provided) */
  publicKey?: string;
  /** Whether to require a valid signature */
  requireSignature?: boolean;
  /** Whether to perform security scanning */
  performSecurityScan?: boolean;
}

/**
 * Verifies a pack artifact for security and integrity.
 *
 * @param options - Verification options
 * @returns Verification result
 */
export function verifyPackArtifact(options: VerifyPackOptions): PackVerificationResult {
  const failures: string[] = [];

  // Verify signature if required
  if (options.requireSignature || options.signature) {
    if (!options.signature) {
      failures.push("pack_verify.missing_signature: Pack is not signed but signature is required");
    } else if (!options.publicKey) {
      failures.push("pack_verify.missing_public_key: Public key is required to verify signature");
    } else {
      const sigValid = verifyPackSignature(options.manifest, options.signature, options.publicKey);
      if (!sigValid) {
        failures.push("pack_verify.invalid_signature: Signature verification failed - pack may be tampered");
      }
    }
  }

  // Perform security scan if requested
  let securityScan: SecurityScanResult | undefined;
  if (options.performSecurityScan && options.sourceCode) {
    const contentHash = generateArtifactHash(options.sourceCode);
    securityScan = scanPackSecurity(options.sourceCode, contentHash);

    if (!securityScan.passed) {
      const criticalIssues = securityScan.issues
        .filter(i => i.severity === "critical")
        .map(i => i.code)
        .join(", ");
      failures.push(`pack_verify.security_scan_failed: Critical security issues detected: ${criticalIssues}`);
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    securityScan,
    signatureValid: options.signature && options.publicKey
      ? verifyPackSignature(options.manifest, options.signature, options.publicKey)
      : undefined,
  };
}

export function validateBusinessPackManifest(
  manifest: BusinessPackManifest,
  options: {
    activeDomainIds?: readonly string[];
  } = {},
): BusinessPackManifest {
  if (manifest.packId.trim().length === 0) {
    throw new ValidationError("pack_sdk.invalid_pack_id", "Business pack manifest requires a non-empty packId.");
  }
  if (manifest.capabilities.length === 0) {
    throw new ValidationError("pack_sdk.empty_capabilities", "Business pack manifest must declare at least one capability.");
  }
  const normalizedDomainId = (manifest.domainId ?? manifest.domain ?? "").trim();
  if (normalizedDomainId.length === 0) {
    throw new ValidationError("pack_sdk.invalid_domain_id", "Business pack manifest requires a non-empty domainId.");
  }
  if (options.activeDomainIds != null && options.activeDomainIds.length > 0 && !options.activeDomainIds.includes(normalizedDomainId)) {
    throw new ValidationError("pack_sdk.domain_not_active", `Business pack manifest requires an active domain descriptor for ${normalizedDomainId}.`);
  }
  return {
    ...manifest,
    packId: manifest.packId.trim(),
    version: manifest.version.trim(),
    domainId: normalizedDomainId,
    domain: normalizedDomainId,
    owner: manifest.owner.trim(),
    sideEffects: dedupeTrimmed(manifest.sideEffects),
    dataClasses: dedupeTrimmed(manifest.dataClasses),
    tools: dedupeTrimmed(manifest.tools),
    connectors: dedupeTrimmed(manifest.connectors),
    plugins: dedupeTrimmed(manifest.plugins),
    maxRiskClass: manifest.maxRiskClass ?? "medium",
    evalRequirements: {
      requiredDatasets: dedupeTrimmed(manifest.evalRequirements?.requiredDatasets),
      blockingEvaluators: dedupeTrimmed(manifest.evalRequirements?.blockingEvaluators),
      ...(manifest.evalRequirements?.acceptanceThresholds !== undefined
        ? { acceptanceThresholds: { ...manifest.evalRequirements.acceptanceThresholds } }
        : {}),
    },
    compatibility: {
      requiresActiveDomain: manifest.compatibility?.requiresActiveDomain ?? true,
      ...(manifest.compatibility?.minPlatformVersion !== undefined
        ? { minPlatformVersion: manifest.compatibility.minPlatformVersion.trim() }
        : {}),
      supportedDomainSpecVersions: dedupeTrimmed(manifest.compatibility?.supportedDomainSpecVersions),
    },
    capabilities: manifest.capabilities.map((capability) => ({
      capabilityKey: capability.capabilityKey.trim(),
      profile: {
        maturity: capability.profile?.maturity ?? capability.maturity ?? "experimental",
        requiredContracts: dedupeTrimmed(capability.profile?.requiredContracts ?? capability.requiredContracts),
        ...(capability.profile?.supportedPluginTypes !== undefined
          ? { supportedPluginTypes: [...capability.profile.supportedPluginTypes] }
          : {}),
        ...(capability.profile?.evaluationMode !== undefined
          ? { evaluationMode: capability.profile.evaluationMode }
          : {}),
      },
      maturity: capability.profile?.maturity ?? capability.maturity ?? "experimental",
      requiredContracts: dedupeTrimmed(capability.profile?.requiredContracts ?? capability.requiredContracts),
    })),
  };
}

export function summarizeCapabilityMatrix(
  manifest: BusinessPackManifest,
): Record<NonNullable<BusinessPackCapability["maturity"]>, number> {
  const summary = {
    experimental: 0,
    beta: 0,
    ga: 0,
  };
  for (const capability of manifest.capabilities) {
    const maturity = capability.profile?.maturity ?? capability.maturity ?? "experimental";
    summary[maturity] += 1;
  }
  return summary;
}

function dedupeTrimmed(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}
