/**
 * Protected Governance Integrity Service
 *
 * Provides tamper detection for critical governance surfaces (config, divisions, agents).
 * Captures cryptographic snapshots of these surfaces and detects unauthorized changes.
 *
 * This service helps ensure the integrity of governance-critical files by:
 * - Computing SHA-256 hashes of protected surfaces
 * - Detecting drift between expected and actual configuration
 * - Validating paths against sandbox policy before access
 *
 * Used by the stability rehearsal framework to verify governance integrity
 * before and after critical operations.
 */
import { type SandboxPolicy } from "../iam/sandbox-policy.js";
/** Identifiers for governance surfaces that are protected from tampering */
export type ProtectedGovernanceSurfaceId = "config" | "divisions" | "agents";
/**
 * Snapshot of a single protected governance surface (config, divisions, or agents).
 * Contains hash and metadata for tamper detection.
 */
export interface ProtectedGovernanceSurfaceSnapshot {
    surfaceId: ProtectedGovernanceSurfaceId;
    normalizedPath: string;
    entryType: "directory" | "file";
    exists: boolean;
    hash: string | null;
    fileCount: number;
    issues: string[];
}
/**
 * Complete snapshot of all protected governance surfaces.
 * Used as a baseline for drift detection.
 */
export interface ProtectedGovernanceSnapshot {
    versionId: string;
    bundleHash: string;
    generatedAt: string;
    surfaces: ProtectedGovernanceSurfaceSnapshot[];
    issues: string[];
}
/**
 * Report comparing expected vs actual governance surface state.
 * Indicates whether tampering has occurred since the baseline was captured.
 */
export interface ProtectedGovernanceDriftReport {
    checked: boolean;
    expectedVersion: string | null;
    currentVersion: string | null;
    tampered: boolean;
    issues: string[];
    surfaces: ProtectedGovernanceSurfaceSnapshot[];
}
/** Configuration options for the protected governance integrity service */
export interface ProtectedGovernanceIntegrityServiceOptions {
    configRoot?: string;
    divisionsRoot?: string;
    agentsPath?: string;
    sandboxPolicy?: SandboxPolicy;
}
/**
 * Service for capturing and verifying integrity of protected governance surfaces.
 *
 * Monitors config, divisions, and AGENTS.md files for unauthorized changes
 * by maintaining cryptographic hashes and detecting drift between captures.
 */
export declare class ProtectedGovernanceIntegrityService {
    private readonly configRoot;
    private readonly divisionsRoot;
    private readonly agentsPath;
    private readonly sandboxPolicy;
    /**
     * Creates a new integrity service with the given options.
     * @param options - Override paths and sandbox policy for protected surfaces
     */
    constructor(options?: ProtectedGovernanceIntegrityServiceOptions);
    /**
     * Captures a snapshot of all protected governance surfaces.
     * Computes hashes for each surface for later drift detection.
     */
    captureSnapshot(): ProtectedGovernanceSnapshot;
    /**
     * Detects whether any protected governance surfaces have been tampered with.
     *
     * Compares the current snapshot against an expected version (previously captured)
     * to determine if unauthorized changes occurred.
     *
     * @param expectedVersion - Version ID from a previous snapshot to compare against
     * @returns Drift report indicating whether tampering was detected
     */
    detectTampering(expectedVersion?: string | null): ProtectedGovernanceDriftReport;
    private captureDirectorySurface;
    private captureFileSurface;
    private resolveDeclaredPath;
    private walkDirectory;
}
