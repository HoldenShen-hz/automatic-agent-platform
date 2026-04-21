/**
 * @fileoverview Chaos Engineering Experiment Scheduler
 *
 * Provides:
 * - Experiment scheduling and lifecycle management
 * - Steady-state hypothesis validation
 * - Automated experiment termination on violation
 * - Experiment result classification (success/failure/inconclusive)
 *
 * §68 混沌工程 - 实验调度 + 自动化稳态验证
 */
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
export class ChaosExperimentScheduler {
    experiments = new Map();
    steadyStateCache = new Map();
    scheduleExperiment(input) {
        const experiment = {
            experimentId: newId("chaos"),
            name: input.name,
            description: input.description,
            target: input.target,
            fault: input.fault,
            steadyStateHypotheses: input.steadyStateHypotheses,
            status: "scheduled",
            scheduledAt: input.scheduledAt,
            startedAt: null,
            completedAt: null,
            maxDurationMs: input.maxDurationMs,
            results: [],
        };
        this.experiments.set(experiment.experimentId, experiment);
        return experiment;
    }
    startExperiment(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== "scheduled")
            return false;
        experiment.status = "running";
        experiment.startedAt = nowIso();
        return true;
    }
    recordSteadyStateResult(experimentId, hypothesisName, measuredValue, passed, message) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== "running")
            return;
        const result = {
            timestamp: nowIso(),
            steadyStateName: hypothesisName,
            passed,
            measuredValue,
            tolerance: experiment.steadyStateHypotheses.find((h) => h.name === hypothesisName)?.tolerance ?? 0,
            message,
        };
        experiment.results = [...experiment.results, result];
        // Check if all hypotheses have been evaluated
        if (experiment.results.length >= experiment.steadyStateHypotheses.length) {
            const allPassed = experiment.results.every((r) => r.passed);
            experiment.status = allPassed ? "completed" : "violated";
            experiment.completedAt = nowIso();
        }
    }
    injectFault(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== "running")
            return null;
        return experiment.fault;
    }
    autoTerminateIfNeeded(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== "running")
            return false;
        if (experiment.startedAt) {
            const elapsed = Date.now() - new Date(experiment.startedAt).getTime();
            if (elapsed >= experiment.maxDurationMs) {
                experiment.status = "cancelled";
                experiment.completedAt = nowIso();
                return true;
            }
        }
        return false;
    }
    validateSteadyState(metricName, currentValue, hypothesis) {
        switch (hypothesis.operator) {
            case "lt": return currentValue < hypothesis.tolerance;
            case "gt": return currentValue > hypothesis.tolerance;
            case "eq": return currentValue === hypothesis.tolerance;
            case "ne": return currentValue !== hypothesis.tolerance;
            case "lte": return currentValue <= hypothesis.tolerance;
            case "gte": return currentValue >= hypothesis.tolerance;
        }
    }
    getExperiment(experimentId) {
        return this.experiments.get(experimentId) ?? null;
    }
    listExperiments(status) {
        if (status) {
            return [...this.experiments.values()].filter((e) => e.status === status);
        }
        return [...this.experiments.values()];
    }
    cancelExperiment(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== "scheduled" && experiment.status !== "running") {
            return false;
        }
        experiment.status = "cancelled";
        experiment.completedAt = nowIso();
        return true;
    }
}
//# sourceMappingURL=chaos-experiment-scheduler.js.map