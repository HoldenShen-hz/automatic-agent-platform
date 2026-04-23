/**
 * Artifact Store
 *
 * Provides a secure, sandboxed file storage system for task artifacts.
 * Artifacts are organized in a hierarchical directory structure:
 * rootDir/taskId/artifactId/filename
 *
 * Security is enforced through sandbox policies that restrict write access
 * to approved directory trees. All content is validated and sanitized before
 * storage, with SHA-256 checksums computed for integrity verification.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/artifact_store_contract.md | Artifact Store Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/sandbox_and_auth_contract.md | Sandbox and Auth Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */
import type { ArtifactRecord, ArtifactRef } from "../../contracts/types/domain.js";
import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import { type SanitizedToolOutput } from "../../execution/tool-executor/tool-output-sanitizer.js";
import { SensitiveContentScanner, type SensitiveContentFinding } from "./sensitive-content-scanner.js";
/**
 * Input parameters for writing a text artifact to the store.
 */
export interface ArtifactWriteInput {
    /** Unique identifier of the task that owns this artifact */
    taskId: string;
    /** Optional identifier of the execution that produced this artifact */
    executionId?: string | null;
    /** Optional identifier of the specific step that produced this artifact */
    stepId?: string | null;
    /** Classification/kind of artifact (e.g., "code", "document", "image") */
    kind: string;
    /** Original filename for the artifact */
    fileName: string;
    /** MIME type of the content (defaults to "text/plain" if not specified) */
    mimeType?: string;
    /** The actual text content to store */
    content: string;
    /** Optional metadata tracking the lineage/ancestry of this artifact */
    lineage?: Record<string, unknown>;
}
/**
 * Result of a successful artifact write operation containing both
 * the full artifact record and a lightweight reference.
 */
export interface ArtifactWriteResult {
    /** Complete artifact record with all metadata */
    record: ArtifactRecord;
    /** Lightweight reference suitable for passing to other components */
    ref: ArtifactRef;
    /** Sanitization and secret-scan summary for the stored content */
    scan: Pick<SanitizedToolOutput, "redactionCount" | "controlCharsRemoved" | "ansiRemoved" | "injectionRisk" | "matchedInjectionRules" | "warnings"> & {
        contentSanitized: boolean;
        sensitiveFindings: SensitiveContentFinding[];
        sensitiveFindingCount: number;
        criticalSensitiveFindingCount: number;
    };
}
/**
 * Configuration options for the ArtifactStore.
 */
export interface ArtifactStoreOptions {
    /** Root directory for artifact storage (defaults to data/artifacts) */
    rootDir?: string;
    /** Sandbox policy controlling where artifacts can be written */
    sandboxPolicy?: SandboxPolicy;
    /** Sensitive content scanner used before persisting artifacts */
    sensitiveContentScanner?: SensitiveContentScanner;
}
/**
 * Secure artifact storage service with sandboxed file system access.
 *
 * Manages the creation and organization of artifact files on disk with
 * hierarchical directory structure: rootDir/taskId/artifactId/filename
 *
 * All write operations are protected by sandbox policies to prevent
 * writes outside the designated artifact directory tree.
 */
export declare class ArtifactStore {
    private readonly rootDir;
    private readonly sandboxPolicy;
    private readonly sensitiveContentScanner;
    /**
     * Creates a new artifact store instance.
     *
     * @param options - Configuration options including root directory and sandbox policy
     */
    constructor(options?: ArtifactStoreOptions);
    /**
     * Writes a text artifact to the store with full metadata and integrity checks.
     *
     * The artifact is stored in a hierarchical directory structure:
     * rootDir/taskId/artifactId/sanitized_filename
     *
     * Each write operation:
     * 1. Generates a unique artifact ID
     * 2. Sanitizes the filename to prevent path traversal
     * 3. Creates necessary directories with sandbox validation
     * 4. Computes SHA-256 checksum of content
     * 5. Writes the content to disk
     * 6. Returns both a full record and a reference
     *
     * @param input - The artifact write input including content and metadata
     * @returns The created artifact record and a lightweight reference
    */
    writeTextArtifact(input: ArtifactWriteInput): ArtifactWriteResult;
    /**
     * Writes a JSON artifact to the store with automatic content serialization.
     *
     * Convenience method that automatically:
     * - Sets the MIME type to "application/json"
     * - Appends ".json" extension if not already present
     * - Sanitizes structured leaf content before serialization
     * - Serializes the content object with pretty-printing (2-space indent)
     *
     * @param input - The artifact input with content as a serializable object
     * @returns The created artifact record and a lightweight reference
     */
    writeJsonArtifact(input: Omit<ArtifactWriteInput, "mimeType" | "content"> & {
        content: unknown;
    }): ArtifactWriteResult;
    /**
     * Internal write implementation shared by text and JSON artifact writers.
     */
    private writeArtifact;
    /**
     * Ensures a directory exists and is writable according to the sandbox policy.
     *
     * This method:
     * 1. Validates the parent directory against the sandbox policy
     * 2. Creates the directory recursively if it doesn't exist
     * 3. Validates the created directory against the sandbox policy
     * 4. Confirms the directory actually exists on disk
     *
     * @param path - The directory path to ensure is writable
     * @param policy - The sandbox policy to validate against
     * @returns The resolved canonical path if all validations pass
     * @throws Error if the parent is denied by policy, path is denied by policy,
     *         or the directory doesn't exist after creation
     */
    private ensureWritableDirectory;
}
