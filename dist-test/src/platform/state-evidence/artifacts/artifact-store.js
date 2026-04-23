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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { checkSandboxPath, createWorkspaceWritePolicy, } from "../../control-plane/iam/sandbox-policy.js";
import { sanitizeStructuredOutput, sanitizeToolOutput, } from "../../execution/tool-executor/tool-output-sanitizer.js";
import { SandboxError, ValidationError } from "../../contracts/errors.js";
import { SensitiveContentScanner, } from "./sensitive-content-scanner.js";
/** Default root directory for artifact storage relative to current working directory */
const DEFAULT_ARTIFACT_ROOT = join(process.cwd(), "data", "artifacts");
/**
 * Secure artifact storage service with sandboxed file system access.
 *
 * Manages the creation and organization of artifact files on disk with
 * hierarchical directory structure: rootDir/taskId/artifactId/filename
 *
 * All write operations are protected by sandbox policies to prevent
 * writes outside the designated artifact directory tree.
 */
export class ArtifactStore {
    rootDir;
    sandboxPolicy;
    sensitiveContentScanner;
    /**
     * Creates a new artifact store instance.
     *
     * @param options - Configuration options including root directory and sandbox policy
     */
    constructor(options = {}) {
        this.rootDir = options.rootDir ?? DEFAULT_ARTIFACT_ROOT;
        // Create a policy that restricts writes to the parent of the root directory
        // to prevent directory traversal attacks
        this.sandboxPolicy =
            options.sandboxPolicy ?? createWorkspaceWritePolicy(dirname(this.rootDir));
        this.sensitiveContentScanner = options.sensitiveContentScanner ?? new SensitiveContentScanner();
    }
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
    writeTextArtifact(input) {
        const sanitizedContent = sanitizeArtifactContent(input.content);
        return this.writeArtifact({
            ...input,
            mimeType: input.mimeType ?? "text/plain",
            sanitizedContent,
            contentWasSanitized: sanitizedContent.sanitizedText !== input.content,
        });
    }
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
    writeJsonArtifact(input) {
        const sanitizedContent = sanitizeStructuredArtifactContent(input.content);
        return this.writeArtifact({
            ...input,
            mimeType: "application/json",
            fileName: input.fileName.endsWith(".json") ? input.fileName : `${input.fileName}.json`,
            sanitizedContent,
            contentWasSanitized: sanitizedContent.changed,
        });
    }
    /**
     * Internal write implementation shared by text and JSON artifact writers.
     */
    writeArtifact(input) {
        const artifactId = newId("artifact");
        const createdAt = nowIso();
        // Sanitize filename to remove potentially dangerous characters
        const safeFileName = sanitizeFileName(input.fileName);
        const sanitizedContent = input.sanitizedContent;
        const sensitiveContentScan = this.sensitiveContentScanner.scanText(sanitizedContent.sanitizedText);
        if (sensitiveContentScan.blocked) {
            throw new ValidationError("artifact.sensitive_content_blocked", "Artifact content contains blocked sensitive material.", {
                category: "validation",
                source: "storage",
                details: {
                    taskId: input.taskId,
                    fileName: safeFileName,
                    findings: sensitiveContentScan.findings,
                    criticalFindingCount: sensitiveContentScan.criticalFindingCount,
                },
            });
        }
        // Ensure root directory exists and is writable according to policy
        const rootPath = this.ensureWritableDirectory(this.rootDir, this.sandboxPolicy);
        // Narrow the sandbox policy to only allow writes within the root path
        const rootPolicy = {
            ...this.sandboxPolicy,
            allowedRoots: [rootPath],
        };
        // Create task-specific subdirectory
        const taskDir = this.ensureWritableDirectory(join(rootPath, input.taskId), rootPolicy);
        // Further narrow policy to task directory
        const taskPolicy = {
            ...rootPolicy,
            allowedRoots: [taskDir],
        };
        // Create artifact-specific subdirectory
        const artifactDir = this.ensureWritableDirectory(join(taskDir, artifactId), taskPolicy);
        // Final storage path within the artifact directory
        const storagePath = join(artifactDir, safeFileName);
        // Compute SHA-256 checksum for integrity verification
        const checksum = sha256(sanitizedContent.sanitizedText);
        // Write the actual content to disk
        writeFileSync(storagePath, sanitizedContent.sanitizedText, "utf8");
        const sizeBytes = Buffer.byteLength(sanitizedContent.sanitizedText, "utf8");
        const record = {
            artifactId,
            taskId: input.taskId,
            executionId: input.executionId ?? null,
            stepId: input.stepId ?? null,
            kind: input.kind,
            storagePath,
            fileName: safeFileName,
            mimeType: input.mimeType ?? "text/plain",
            sizeBytes,
            checksum,
            lineageJson: JSON.stringify({
                ...(input.lineage ?? {}),
                artifactSafety: {
                    contentSanitized: input.contentWasSanitized,
                    redactionCount: sanitizedContent.redactionCount,
                    controlCharsRemoved: sanitizedContent.controlCharsRemoved,
                    ansiRemoved: sanitizedContent.ansiRemoved,
                    injectionRisk: sanitizedContent.injectionRisk,
                    matchedInjectionRules: sanitizedContent.matchedInjectionRules,
                    warnings: sanitizedContent.warnings,
                    sensitiveFindings: sensitiveContentScan.findings,
                    sensitiveFindingCount: sensitiveContentScan.findings.length,
                    criticalSensitiveFindingCount: sensitiveContentScan.criticalFindingCount,
                },
            }),
            createdAt,
        };
        return {
            record,
            ref: {
                artifactId,
                kind: input.kind,
                uri: storagePath,
                mimeType: record.mimeType,
                sizeBytes,
                checksum,
                createdAt,
            },
            scan: {
                contentSanitized: input.contentWasSanitized,
                redactionCount: sanitizedContent.redactionCount,
                controlCharsRemoved: sanitizedContent.controlCharsRemoved,
                ansiRemoved: sanitizedContent.ansiRemoved,
                injectionRisk: sanitizedContent.injectionRisk,
                matchedInjectionRules: sanitizedContent.matchedInjectionRules,
                warnings: sanitizedContent.warnings,
                sensitiveFindings: sensitiveContentScan.findings,
                sensitiveFindingCount: sensitiveContentScan.findings.length,
                criticalSensitiveFindingCount: sensitiveContentScan.criticalFindingCount,
            },
        };
    }
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
    ensureWritableDirectory(path, policy) {
        const parentPath = dirname(path);
        // Verify parent directory is allowed by sandbox policy
        const parentCheck = checkSandboxPath(policy, parentPath);
        if (!parentCheck.allowed) {
            throw new SandboxError(parentCheck.reasonCode ?? "artifact.parent_denied", `${parentCheck.reasonCode ?? "artifact.parent_denied"}: Parent directory access denied: ${parentPath}`, {
                details: { path: parentPath, reasonCode: parentCheck.reasonCode },
            });
        }
        // Create the directory recursively (mkdir -p behavior)
        mkdirSync(path, { recursive: true });
        // Verify the newly created directory is allowed by sandbox policy
        const directoryCheck = checkSandboxPath(policy, path);
        if (!directoryCheck.allowed) {
            throw new SandboxError(directoryCheck.reasonCode ?? "artifact.path_denied", `${directoryCheck.reasonCode ?? "artifact.path_denied"}: Directory access denied: ${path}`, {
                details: { path, reasonCode: directoryCheck.reasonCode },
            });
        }
        // Double-check the directory actually exists (guards against TOCTOU race)
        if (!existsSync(directoryCheck.normalizedPath)) {
            throw new SandboxError("artifact.path_missing", `artifact.path_missing: Directory missing after creation: ${path}`, {
                details: { path },
            });
        }
        // Return the resolved absolute path
        return resolve(path);
    }
}
/**
 * Sanitizes artifact content using the tool output sanitizer.
 */
function sanitizeArtifactContent(content) {
    return sanitizeToolOutput(content, {
        persistedMessageLimitChars: Math.max(4_000, content.length + 1),
    });
}
/**
 * Sanitizes structured artifact content by serializing to JSON and sanitizing.
 */
function sanitizeStructuredArtifactContent(content) {
    const serialized = JSON.stringify(content, null, 2);
    const sanitized = sanitizeStructuredOutput(content);
    const sanitizedText = JSON.stringify(sanitized.sanitizedValue, null, 2);
    return {
        rawRef: null,
        sanitizedText,
        truncated: false,
        redactionCount: sanitized.redactionCount,
        controlCharsRemoved: sanitized.controlCharsRemoved,
        ansiRemoved: sanitized.ansiRemoved,
        nfcNormalized: sanitized.nfcNormalized,
        unicodeTagsRemoved: sanitized.unicodeTagsRemoved,
        zeroWidthCharsRemoved: sanitized.zeroWidthCharsRemoved,
        privateUseCharsRemoved: sanitized.privateUseCharsRemoved,
        injectionRisk: sanitized.injectionRisk,
        matchedInjectionRules: sanitized.matchedInjectionRules,
        warnings: sanitized.warnings,
        changed: sanitizedText !== serialized,
    };
}
/**
 * Sanitizes a filename to prevent path traversal and other security issues.
 *
 * Replaces any sequence of non-alphanumeric characters (except dots, underscores,
 * and hyphens) with underscores, then trims leading/trailing underscores.
 * If the result is empty, returns "artifact.txt" as a safe default.
 *
 * @param fileName - The original filename to sanitize
 * @returns A safe filename containing only alphanumeric, dot, underscore, and hyphen
 */
function sanitizeFileName(fileName) {
    const sanitized = fileName
        .trim()
        // Replace sequences of special characters with single underscore
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        // Remove leading and trailing underscores
        .replace(/^_+|_+$/g, "");
    // Fallback to default name if sanitization removed everything
    return sanitized.length > 0 ? sanitized : "artifact.txt";
}
/**
 * Computes the SHA-256 hash of a string value.
 *
 * @param value - The string to hash
 * @returns The hexadecimal representation of the SHA-256 hash
 */
function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
//# sourceMappingURL=artifact-store.js.map