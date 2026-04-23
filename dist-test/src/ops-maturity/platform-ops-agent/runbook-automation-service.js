import { newId, nowIso } from "../../platform/contracts/types/ids.js";
function executeStep(stepName, stepIndex, isDryRun) {
    const simulatedDelay = 50 + Math.random() * 150;
    if (isDryRun) {
        return {
            stepId: `step_${stepIndex}`,
            stepName,
            status: "skipped",
            output: `[DRY RUN] Would execute: \${stepName}`,
            durationMs: Math.round(simulatedDelay),
        };
    }
    const success = Math.random() > 0.05;
    if (success) {
        return {
            stepId: `step_${stepIndex}`,
            stepName,
            status: "success",
            output: `Successfully executed: \${stepName}`,
            durationMs: Math.round(simulatedDelay),
        };
    }
    return {
        stepId: `step_${stepIndex}`,
        stepName,
        status: "failed",
        error: `Step failed: \${stepName} - simulated failure for testing`,
        durationMs: Math.round(simulatedDelay),
    };
}
export class RunbookAutomationService {
    executionHistory = new Map();
    maxHistoryEntries = 100;
    execute(runbook, context) {
        const executionId = newId("ops_runbook_exec");
        const startedAt = nowIso();
        const isDryRun = context?.dryRun ?? false;
        const stepResults = [];
        const completedSteps = [];
        for (let i = 0; i < runbook.steps.length; i++) {
            const stepName = runbook.steps[i];
            const result = executeStep(stepName, i, isDryRun);
            stepResults.push(result);
            if (result.status === "success" || result.status === "skipped") {
                completedSteps.push(stepName);
            }
            else {
                break;
            }
        }
        const completedAt = nowIso();
        const allSucceeded = stepResults.every((r) => r.status === "success" || r.status === "skipped");
        const status = allSucceeded ? "completed" : "failed";
        const totalDurationMs = stepResults.reduce((sum, r) => sum + r.durationMs, 0);
        const execution = {
            executionId,
            runbookId: runbook.runbookId,
            startedAt,
            completedAt,
            completedSteps,
            stepResults,
            status,
            totalDurationMs,
        };
        this.executionHistory.set(executionId, execution);
        this.evictOldEntries();
        return execution;
    }
    getExecution(executionId) {
        return this.executionHistory.get(executionId) ?? null;
    }
    listExecutions(runbookId, limit = 10) {
        const all = [...this.executionHistory.values()];
        const filtered = runbookId ? all.filter((e) => e.runbookId === runbookId) : all;
        return filtered.slice(-limit).reverse();
    }
    getStatistics() {
        const all = [...this.executionHistory.values()];
        if (all.length === 0) {
            return { totalExecutions: 0, successCount: 0, failureCount: 0, averageDurationMs: 0 };
        }
        const successCount = all.filter((e) => e.status === "completed").length;
        const failureCount = all.filter((e) => e.status === "failed").length;
        const totalDurationMs = all.reduce((sum, e) => sum + e.totalDurationMs, 0);
        return {
            totalExecutions: all.length,
            successCount,
            failureCount,
            averageDurationMs: Math.round(totalDurationMs / all.length),
        };
    }
    evictOldEntries() {
        if (this.executionHistory.size <= this.maxHistoryEntries)
            return;
        const entries = [...this.executionHistory.entries()];
        const toRemove = entries.slice(0, entries.length - this.maxHistoryEntries);
        for (const [key] of toRemove) {
            this.executionHistory.delete(key);
        }
    }
}
//# sourceMappingURL=runbook-automation-service.js.map