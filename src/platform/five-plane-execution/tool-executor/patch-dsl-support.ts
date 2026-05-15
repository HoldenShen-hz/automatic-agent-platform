import { readFileSync } from "node:fs";

import type { CodeDiagnosticsSummary } from "./code-diagnostics-service.js";
import type { FileSnapshot, FreshnessConfig } from "../../five-plane-control-plane/iam/file-freshness.js";
import type { SandboxPolicy } from "../../five-plane-control-plane/iam/sandbox-policy.js";

export interface PatchHunk {
  /** Starting line number in the original file */
  oldStart: number;
  /** Number of lines in the original file this hunk covers */
  oldCount: number;
  /** Starting line number in the modified file */
  newStart: number;
  /** Number of lines in the modified file this hunk produces */
  newCount: number;
  /** Content lines of this hunk (including diff markers) */
  lines: string[];
}

/**
 * A complete file patch with hunks and optional freshness snapshot.
 */
export interface FilePatch {
  /** Original file path (empty for new files) */
  oldPath: string;
  /** Target file path (empty for deletions) */
  newPath: string;
  /** Hunks of changes to apply */
  hunks: PatchHunk[];
  /** Optional: expected file snapshot for freshness check */
  expectedSnapshot?: FileSnapshot | null;
}

/**
 * Request to apply one or more patches.
 */
export interface PatchApplicationRequest {
  /** Unique call identifier */
  callId: string;
  /** Task context identifier */
  taskId: string;
  /** Execution context identifier */
  executionId: string | null;
  /** Distributed tracing identifier */
  traceId: string;
  /** Tool name (should be "apply_patch") */
  toolName: string;
  /** Sandbox policy for path validation */
  sandboxPolicy: SandboxPolicy;
  /** Optional path scope restrictions */
  allowedPathRoots?: readonly string[];
  /** Patches to apply */
  patches: readonly FilePatch[];
  /** If true, fail when hunk cannot be matched exactly */
  strictMode?: boolean;
  /** If true, allow creating new files */
  allowCreation?: boolean;
  /** Configuration for freshness validation */
  freshnessConfig?: FreshnessConfig;
  /** Timestamp of the operation (defaults to now) */
  occurredAt?: string;
}

/**
 * Result of applying a single file patch.
 */
export interface PatchResult {
  /** File path affected */
  filePath: string;
  /** Status of the patch application */
  status: "applied" | "created" | "deleted" | "moved" | "failed" | "skipped";
  /** Number of hunks successfully applied */
  hunksApplied: number;
  /** Total number of hunks in the patch */
  hunksTotal: number;
  /** Error code if failed */
  errorCode?: string;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Complete result of a patch application request.
 */
export interface PatchApplicationResult {
  /** Call identifier */
  callId: string;
  /** Tool that was invoked */
  toolName: string;
  /** Overall status */
  status: "succeeded" | "failed" | "blocked";
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable output summary */
  output: string | null;
  /** Results for each individual patch */
  results: PatchResult[];
  /** Code diagnostics for changed files */
  diagnostics: CodeDiagnosticsSummary | null;
  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * Internal structure for a prepared patch ready for commitment.
 */
export interface PreparedPatch {
  /** Original patch request */
  patch: FilePatch;
  /** Result object for this patch */
  result: PatchResult;
  /** Classified operation type */
  operation: "update" | "create" | "delete" | "move";
  /** Resolved source path */
  sourcePath: string | null;
  /** Resolved target path */
  targetPath: string | null;
  /** Content before modification */
  originalContent: string | null;
  /** Content after modification */
  nextContent: string | null;
}

/**
 * Snapshot of file state before modification, for rollback.
 */
export interface FileStateSnapshot {
  /** Whether the file existed before */
  existed: boolean;
  /** Content if file existed, null otherwise */
  content: string | null;
}

/**
 * Parses a unified diff format string into file patches.
 *
 * Unified diff format:
 * --- path/to/original
 * +++ path/to/modified
 * @@ -start,count +start,count @@
 *  context or changes
 */
function parseUnifiedDiff(content: string): FilePatch[] {
  const patches: FilePatch[] = [];
  const lines = content.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.startsWith("--- ")) {
      index += 1;
      continue;
    }

    const oldPath = normalizeDiffPath(line.slice(4));
    const nextLine = lines[index + 1] ?? "";
    if (!nextLine.startsWith("+++ ")) {
      index += 1;
      continue;
    }

    const newPath = normalizeDiffPath(nextLine.slice(4));
    index += 2;
    const hunks: PatchHunk[] = [];

    // Parse hunks within this file change
    while (index < lines.length) {
      const header = lines[index] ?? "";
      if (!header.startsWith("@@")) {
        // New file section starting
        if (header.startsWith("--- ")) {
          break;
        }
        index += 1;
        continue;
      }

      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const parsedHeader = parseHunkHeader(header);
      const hunkLines = [header];
      index += 1;

      // Collect hunk body lines until next hunk or file
      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        if (candidate.startsWith("@@") || candidate.startsWith("--- ")) {
          break;
        }
        hunkLines.push(candidate);
        index += 1;
      }

      hunks.push({
        oldStart: parsedHeader.oldStart,
        oldCount: parsedHeader.oldCount,
        newStart: parsedHeader.newStart,
        newCount: parsedHeader.newCount,
        lines: hunkLines,
      });
    }

    patches.push({ oldPath, newPath, hunks });
  }

  return patches;
}

/**
 * Parses a Codex-style patch format into file patches.
 *
 * Codex format:
 * *** Begin Patch
 * *** Add File: path/to/new/file
 * [content lines]
 * *** Update File: path/to/existing/file
 * [hunk headers and content]
 * *** Delete File: path/to/file
 * *** End Patch
 */
function parseCodexPatch(content: string): FilePatch[] {
  const patches: FilePatch[] = [];
  const lines = content.split("\n");
  let index = 0;

  // Skip initial blank lines
  while (index < lines.length && (lines[index] ?? "").trim().length === 0) {
    index += 1;
  }
  if ((lines[index] ?? "") !== "*** Begin Patch") {
    return [];
  }
  index += 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line === "*** End Patch") {
      break;
    }

    // New file creation
    if (line.startsWith("*** Add File: ")) {
      const newPath = line.slice("*** Add File: ".length).trim();
      index += 1;
      const hunkBody: string[] = ["@@ -0,0 +1,0 @@"];
      while (index < lines.length && !(lines[index] ?? "").startsWith("*** ")) {
        hunkBody.push(lines[index] ?? "");
        index += 1;
      }
      const counts = deriveHunkCounts(hunkBody);
      patches.push({
        oldPath: "",
        newPath,
        hunks: [{
          oldStart: 1,
          oldCount: counts.oldCount,
          newStart: 1,
          newCount: counts.newCount,
          lines: hunkBody,
        }],
      });
      continue;
    }

    // File deletion
    if (line.startsWith("*** Delete File: ")) {
      const oldPath = line.slice("*** Delete File: ".length).trim();
      patches.push({
        oldPath,
        newPath: "",
        hunks: [],
      });
      index += 1;
      continue;
    }

    // File update (may include move destination)
    if (line.startsWith("*** Update File: ")) {
      const oldPath = line.slice("*** Update File: ".length).trim();
      let newPath = oldPath;
      index += 1;

      // Check for move destination
      if ((lines[index] ?? "").startsWith("*** Move to: ")) {
        newPath = (lines[index] ?? "").slice("*** Move to: ".length).trim();
        index += 1;
      }

      const hunks: PatchHunk[] = [];
      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        if (candidate === "*** End Patch" || candidate.startsWith("*** Add File: ") || candidate.startsWith("*** Delete File: ") || candidate.startsWith("*** Update File: ")) {
          break;
        }
        if (!candidate.startsWith("@@")) {
          index += 1;
          continue;
        }

        // Parse this hunk
        const parsedHeader = parseHunkHeader(candidate);
        const hunkLines = [candidate];
        index += 1;

        // Collect hunk body
        while (index < lines.length) {
          const bodyLine = lines[index] ?? "";
          if (bodyLine.startsWith("@@") || bodyLine === "*** End Patch" || bodyLine.startsWith("*** Add File: ") || bodyLine.startsWith("*** Delete File: ") || bodyLine.startsWith("*** Update File: ")) {
            break;
          }
          hunkLines.push(bodyLine);
          index += 1;
        }

        const counts = deriveHunkCounts(hunkLines);
        hunks.push({
          oldStart: parsedHeader.oldStart,
          oldCount: parsedHeader.hasExplicitCounts ? parsedHeader.oldCount : counts.oldCount,
          newStart: parsedHeader.newStart,
          newCount: parsedHeader.hasExplicitCounts ? parsedHeader.newCount : counts.newCount,
          lines: hunkLines,
        });
      }

      patches.push({ oldPath, newPath, hunks });
      continue;
    }

    index += 1;
  }

  return patches;
}

/**
 * Auto-detects patch format and delegates to appropriate parser.
 */
export function parsePatch(content: string): FilePatch[] {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("*** Begin Patch")) {
    return parseCodexPatch(content);
  }
  return parseUnifiedDiff(content);
}

/**
 * Normalizes a path from unified diff format.
 * Handles /dev/null, a/ prefix, b/ prefix, and tab-splitting.
 */
function normalizeDiffPath(rawPath: string): string {
  const pathPart = rawPath.split("\t")[0] ?? "";
  if (pathPart === "/dev/null") {
    return "";
  }
  if (pathPart.startsWith("a/") || pathPart.startsWith("b/")) {
    return pathPart.slice(2);
  }
  return pathPart;
}

/**
 * Checks if a path represents a null/empty path.
 */
export function isNullPath(inputPath: string): boolean {
  const trimmed = inputPath.trim();
  return trimmed.length === 0 || trimmed === "/dev/null";
}

/**
 * Parses a hunk header to extract line numbers and counts.
 *
 * Format: @@ -oldStart[,oldCount] +newStart[,newCount] @@
 */
function parseHunkHeader(header: string): {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  hasExplicitCounts: boolean;
} {
  const match = header.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (match == null) {
    return {
      oldStart: 1,
      oldCount: 0,
      newStart: 1,
      newCount: 0,
      hasExplicitCounts: false,
    };
  }

  return {
    oldStart: parseInt(match[1] ?? "1", 10),
    oldCount: parseInt(match[2] ?? "1", 10),
    newStart: parseInt(match[3] ?? "1", 10),
    newCount: parseInt(match[4] ?? "1", 10),
    hasExplicitCounts: true,
  };
}

/**
 * Derives hunk line counts from hunk body content.
 * Counts additions, deletions, and context lines.
 */
function deriveHunkCounts(lines: readonly string[]): { oldCount: number; newCount: number } {
  let oldCount = 0;
  let newCount = 0;

  for (const line of lines) {
    if (line.startsWith("@@") || line === "\\ No newline at end of file") {
      continue;
    }

    if (line.startsWith("+")) {
      newCount += 1;
      continue;
    }

    if (line.startsWith("-")) {
      oldCount += 1;
      continue;
    }

    // Context line - appears in both
    oldCount += 1;
    newCount += 1;
  }

  return { oldCount, newCount };
}

/**
 * Reads an existing file's content.
 */
export function readExistingFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

/**
 * Creates a skipped result for a patch that wasn't applied.
 */
export function createSkippedResult(patch: FilePatch): PatchResult {
  return {
    filePath: patch.newPath || patch.oldPath,
    status: "skipped",
    hunksApplied: 0,
    hunksTotal: patch.hunks.length,
  };
}

/**
 * PatchDslService applies structured patches to files with validation and rollback.
 *
 * The service provides:
 * 1. Multi-format parsing (unified diff, Codex)
 * 2. Sandbox path validation before any file operation
 * 3. Atomic patch application with all-or-nothing semantics
 * 4. Automatic rollback on failure
 * 5. Freshness checking to prevent overwriting external changes
 *
 * Operations are classified as:
 * - create: New file (oldPath is null/empty)
 * - delete: Remove file (newPath is null/empty)
 * - update: Modify existing file (same path)
 * - move: Rename file (different oldPath and newPath)
 */
