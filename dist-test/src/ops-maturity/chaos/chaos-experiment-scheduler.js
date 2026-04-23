/**
 * @fileoverview Chaos Engineering Experiment Scheduler
 *
 * Provides:
 * - Experiment scheduling and lifecycle management
 * - Steady-state hypothesis validation
 * - Automated experiment termination on violation
 * - Experiment result classification (success/failure/inconclusive)
 *
 * §68 Chaos Engineering - Experiment Scheduling + Automated Steady-State Validation
 *
 * §66 GameDay Orchestrator (P2 Enhancement for Phase 3):
 * Current scheduleGameDay() / startGameDay() / refreshGameDayStatus() implement basic scheduling skeleton.
 * To implement complete GameDay orchestration capability, the following are needed: real fault injection
 * execution, integration with monitoring system for steady-state validation, multi-experiment parallel
 * orchestration, and GameDay report generation. Currently ChaosExperimentScheduler lacks integration
 * with external fault injection systems and real steady-state validation pipeline.
 */
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
export class ChaosExperimentScheduler {
    experiments = new Map();
    steadyStateCache = new Map();
    gameDays = new Map();
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
    scheduleGameDay(input) {
        const experimentIds = input.experiments.map((experiment) => this.scheduleExperiment(experiment).experimentId);
        const gameDay = {
            gameDayId: newId("gameday"),
            name: input.name,
            scheduledAt: input.scheduledAt,
            experimentIds,
            status: "scheduled",
            startedAt: null,
            completedAt: null,
        };
        this.gameDays.set(gameDay.gameDayId, gameDay);
        return gameDay;
    }
    startGameDay(gameDayId) {
        const gameDay = this.gameDays.get(gameDayId);
        if (!gameDay || gameDay.status !== "scheduled") {
            return false;
        }
        for (const experimentId of gameDay.experimentIds) {
            this.startExperiment(experimentId);
        }
        gameDay.status = "running";
        gameDay.startedAt = nowIso();
        return true;
    }
    refreshGameDayStatus(gameDayId) {
        const gameDay = this.gameDays.get(gameDayId);
        if (!gameDay) {
            return null;
        }
        const experiments = gameDay.experimentIds
            .map((experimentId) => this.experiments.get(experimentId))
            .filter((item) => item != null);
        if (experiments.some((item) => item.status === "violated")) {
            gameDay.status = "violated";
            gameDay.completedAt = nowIso();
            return gameDay;
        }
        if (experiments.length > 0 && experiments.every((item) => item.status === "completed")) {
            gameDay.status = "completed";
            gameDay.completedAt = nowIso();
        }
        return gameDay;
    }
    getGameDay(gameDayId) {
        return this.gameDays.get(gameDayId) ?? null;
    }
}
//# sourceMappingURL=chaos-experiment-scheduler.js.map