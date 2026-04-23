import { nowIso } from "../../platform/contracts/types/ids.js";
const PHASE_ORDER = [
    "phase1",
    "phase2",
    "phase3",
    "phase4",
    "phase5",
    "phase6",
    "phase7",
    "phase8a",
    "phase8b",
    "phase8c",
    "phase9a",
    "phase9b",
    "phase9c",
    "phase9d",
    "phase9e",
    "phase9f",
];
export class SuccessCriteriaService {
    definitions = new Map();
    measurements = new Map();
    phaseGates = new Map();
    registerCriterion(definition) {
        this.definitions.set(definition.criterionId, definition);
        return definition;
    }
    registerPhaseGate(gate) {
        this.phaseGates.set(gate.phase, gate);
        return gate;
    }
    recordMeasurement(measurement) {
        const record = {
            ...measurement,
            measuredAt: measurement.measuredAt ?? nowIso(),
        };
        this.measurements.set(record.criterionId, [...(this.measurements.get(record.criterionId) ?? []), record]);
        return record;
    }
    evaluateCriterion(criterionId) {
        const definition = this.requireDefinition(criterionId);
        const latest = this.getLatestMeasurement(criterionId);
        const operator = definition.operator ?? "gte";
        const measuredValue = latest?.measuredValue ?? null;
        return {
            criterionId: definition.criterionId,
            passed: latest != null && compareValues(measuredValue, definition.threshold, operator),
            required: definition.required,
            metricKey: definition.metricKey,
            threshold: definition.threshold,
            measuredValue,
            operator,
        };
    }
    evaluatePhaseCriteria(phase) {
        return [...this.definitions.values()]
            .filter((item) => item.phase === phase)
            .map((item) => this.evaluateCriterion(item.criterionId));
    }
    evaluatePhaseAdvance(phase, completedItemIds, deferredItemIds = []) {
        const gate = this.phaseGates.get(phase);
        const evaluations = this.evaluatePhaseCriteria(phase);
        const failedCriteriaIds = evaluations
            .filter((item) => item.required && !item.passed)
            .map((item) => item.criterionId);
        const pendingItemIds = (gate?.requiredItemIds ?? []).filter((itemId) => !completedItemIds.includes(itemId));
        const reasonCodes = [
            ...pendingItemIds.map((itemId) => `roadmap.pending_item:${itemId}`),
            ...failedCriteriaIds.map((criterionId) => `roadmap.failed_criterion:${criterionId}`),
        ];
        if (gate?.blockOnDeferredItems === true) {
            reasonCodes.push(...deferredItemIds.map((itemId) => `roadmap.deferred_item:${itemId}`));
        }
        const allowed = pendingItemIds.length === 0
            && failedCriteriaIds.length === 0
            && !(gate?.blockOnDeferredItems === true && deferredItemIds.length > 0);
        return {
            phase,
            nextPhase: allowed ? PHASE_ORDER[PHASE_ORDER.indexOf(phase) + 1] ?? null : null,
            allowed,
            reasonCodes,
            pendingItemIds,
            failedCriteriaIds,
        };
    }
    listDefinitions(phase) {
        return [...this.definitions.values()].filter((item) => phase == null || item.phase === phase);
    }
    requireDefinition(criterionId) {
        const definition = this.definitions.get(criterionId);
        if (definition == null) {
            throw new Error(`success_criteria.definition_not_found:${criterionId}`);
        }
        return definition;
    }
    getLatestMeasurement(criterionId) {
        const measurements = this.measurements.get(criterionId) ?? [];
        return [...measurements].sort((left, right) => right.measuredAt.localeCompare(left.measuredAt))[0] ?? null;
    }
}
function compareValues(measuredValue, threshold, operator) {
    if (measuredValue == null) {
        return false;
    }
    switch (operator) {
        case "eq":
            return measuredValue === threshold;
        case "neq":
            return measuredValue !== threshold;
        case "lte":
            return typeof measuredValue === "number" && typeof threshold === "number" && measuredValue <= threshold;
        case "gte":
        default:
            return typeof measuredValue === "number" && typeof threshold === "number" && measuredValue >= threshold;
    }
}
//# sourceMappingURL=success-criteria-service.js.map