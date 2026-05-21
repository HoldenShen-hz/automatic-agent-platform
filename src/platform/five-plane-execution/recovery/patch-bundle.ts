/**
 * PatchBundle - Structured Code Changes
 *
 * A structured representation of code changes produced by the build stage.
 * Enables verification and diff analysis.
 */

export type PatchStatus = 'pending' | 'applied' | 'rejected' | 'rolled_back';

const PATCH_PATTERN_REGEX_CACHE = new Map<string, RegExp>();

export interface PatchBundle {
  /** Unique bundle identifier */
  bundleId: string;

  /** Associated task card ID */
  taskId: string;

  /** Files modified */
  changedFiles: readonly ChangedFile[];

  /** Total diff lines across all files */
  totalDiffLines: number;

  /** Creation timestamp */
  createdAt: string;

  /** Author agent ID */
  authorAgentId: string;

  /** Patch status */
  status: PatchStatus;
}

export interface ChangedFile {
  /** File path (relative or absolute) */
  path: string;

  /** Change type */
  operation: 'create' | 'modify' | 'delete' | 'rename';

  /** Diff hunks */
  hunks: readonly DiffHunk[];

  /** Original line count (for modified files) */
  originalLines?: number;

  /** Final line count */
  finalLines?: number;
}

export interface DiffHunk {
  /** Starting line in original file */
  originalStart: number;

  /** Number of lines in original file */
  originalCount: number;

  /** Starting line in final file */
  finalStart: number;

  /** Number of lines in final file */
  finalCount: number;

  /** Diff lines */
  lines: readonly string[];
}

export function createPatchBundle(input: {
  bundleId: string;
  taskId: string;
  changedFiles: readonly ChangedFile[];
  authorAgentId: string;
}): PatchBundle {
  const totalDiffLines = input.changedFiles.reduce(
    (sum, file) =>
      sum + file.hunks.reduce((hunkSum, hunk) => hunkSum + hunk.lines.length, 0),
    0
  );

  return {
    bundleId: input.bundleId,
    taskId: input.taskId,
    changedFiles: input.changedFiles,
    totalDiffLines,
    createdAt: new Date().toISOString(),
    authorAgentId: input.authorAgentId,
    status: 'pending',
  };
}

export function validatePatchBundle(
  bundle: PatchBundle,
  taskCard: { maxChangedFiles: number; maxDiffLines: number; forbiddenPaths: readonly string[] }
): PatchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file count
  if (bundle.changedFiles.length > taskCard.maxChangedFiles) {
    errors.push(
      `Changed files (${bundle.changedFiles.length}) exceeds maximum (${taskCard.maxChangedFiles})`
    );
  }

  // Check diff size
  if (bundle.totalDiffLines > taskCard.maxDiffLines) {
    errors.push(
      `Total diff lines (${bundle.totalDiffLines}) exceeds maximum (${taskCard.maxDiffLines})`
    );
  }

  // Check forbidden paths
  for (const file of bundle.changedFiles) {
    for (const forbidden of taskCard.forbiddenPaths) {
      if (matchesPattern(file.path, forbidden)) {
        errors.push(`File "${file.path}" matches forbidden path pattern "${forbidden}"`);
      }
    }
  }

  // Warnings for large diffs
  if (bundle.totalDiffLines > taskCard.maxDiffLines * 0.8) {
    warnings.push(`Diff size is at 80% of limit`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function matchesPattern(path: string, pattern: string): boolean {
  // Simple glob pattern matching
  const cached = PATCH_PATTERN_REGEX_CACHE.get(pattern);
  if (cached != null) {
    return cached.test(path);
  }
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  const compiled = new RegExp(`^${regex}$`);
  PATCH_PATTERN_REGEX_CACHE.set(pattern, compiled);
  return compiled.test(path);
}

export interface PatchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
