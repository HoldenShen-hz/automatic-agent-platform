/**
 * PatchBundle - Structured Code Changes
 *
 * A structured representation of code changes produced by the build stage.
 * Enables verification and diff analysis.
 */
export function createPatchBundle(input) {
    const totalDiffLines = input.changedFiles.reduce((sum, file) => sum + file.hunks.reduce((hunkSum, hunk) => hunkSum + hunk.lines.length, 0), 0);
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
export function validatePatchBundle(bundle, taskCard) {
    const errors = [];
    const warnings = [];
    // Check file count
    if (bundle.changedFiles.length > taskCard.maxChangedFiles) {
        errors.push(`Changed files (${bundle.changedFiles.length}) exceeds maximum (${taskCard.maxChangedFiles})`);
    }
    // Check diff size
    if (bundle.totalDiffLines > taskCard.maxDiffLines) {
        errors.push(`Total diff lines (${bundle.totalDiffLines}) exceeds maximum (${bundle.totalDiffLines})`);
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
function matchesPattern(path, pattern) {
    // Simple glob pattern matching
    const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(path);
}
//# sourceMappingURL=patch-bundle.js.map