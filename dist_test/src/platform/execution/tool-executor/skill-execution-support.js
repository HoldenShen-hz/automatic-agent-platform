import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const skillExecutionLogger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Normalizes the max attempts value, defaulting based on failure mode.
 */
export function normalizeAttempts(step) {
    return Math.max(1, Math.trunc(step.maxAttempts ?? (step.onFailure === "retry" ? 2 : 1)));
}
/**
 * Generates a default summary message for a step result.
 */
export function defaultSummary(step, status) {
    if (status === "succeeded") {
        return `Skill step ${step.stepId} completed via ${step.resolvedToolName}.`;
    }
    if (status === "partial_success") {
        return `Skill step ${step.stepId} failed via ${step.resolvedToolName} but continued.`;
    }
    return `Skill step ${step.stepId} failed via ${step.resolvedToolName}.`;
}
/**
 * Creates a stable serialization of a value for use in cache keys.
 * Handles arrays, objects (with sorted keys), and primitives.
 */
export function stableSerialize(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
    }
    if (value != null && typeof value === "object") {
        const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
/**
 * Normalizes a working directory path, resolving symlinks.
 */
export function normalizeWorkingDirectory(workingDirectory) {
    if (workingDirectory == null || workingDirectory.trim().length === 0) {
        return null;
    }
    try {
        return realpathSync.native(workingDirectory);
    }
    catch (err) {
        skillExecutionLogger.warn("skill_execution: realpathSync.native failed, using resolve", { error: err instanceof Error ? err.message : String(err), workingDirectory });
        return resolve(workingDirectory);
    }
}
/**
 * Default implementation of git HEAD resolver.
 * Runs `git rev-parse HEAD` in the working directory.
 */
export function defaultGitHeadResolver(workingDirectory) {
    const result = spawnSync("git", ["rev-parse", "HEAD"], {
        cwd: workingDirectory,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status !== 0) {
        return null;
    }
    const gitHead = result.stdout.trim();
    return gitHead.length === 0 ? null : gitHead;
}
/**
 * SkillExecutionService executes multi-step skills with caching and observability.
 *
 * The service:
 * 1. Resolves skill steps and validates tool access
 * 2. Checks cache for previous successful execution (based on git head/source hash)
 * 3. Executes steps sequentially, applying retry logic per step
 * 4. Publishes events for each step transition and overall completion
 * 5. Stores results and updates execution records
 *
 * Each step can specify:
 * - onFailure: "fail" (stop execution), "continue" (mark partial_success), or "retry" (retry the step)
 * - maxAttempts: Number of retry attempts for retry mode
 * - modelOverrides: Override model profile for specific tools
 */
//# sourceMappingURL=skill-execution-support.js.map