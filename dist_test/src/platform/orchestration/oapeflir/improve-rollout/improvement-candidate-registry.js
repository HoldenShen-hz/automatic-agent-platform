import { newId } from "../../../contracts/types/ids.js";
import { parseImprovementCandidate } from "../types/improvement-candidate.js";
export class ImprovementCandidateRegistry {
    candidates = new Map();
    register(input) {
        const candidate = parseImprovementCandidate({
            candidateId: newId("improvement_candidate"),
            taskId: input.taskId,
            sourceSignalRefs: Array.from(new Set(input.learningObjects.flatMap((item) => item.evidenceRefs))),
            sourceLearningObjectIds: input.learningObjects.map((item) => item.learningObjectId),
            changeScope: this.mapTargetToScope(input.target),
            description: input.description,
            expectedBenefit: input.expectedBenefit ?? "Reduce repeated failure modes and improve plan stability.",
            status: "proposed",
            createdAt: Date.now(),
        });
        this.candidates.set(candidate.candidateId, candidate);
        return candidate;
    }
    list() {
        return [...this.candidates.values()];
    }
    updateStatus(candidateId, status) {
        const current = this.candidates.get(candidateId);
        if (!current) {
            return null;
        }
        const updated = { ...current, status };
        this.candidates.set(candidateId, updated);
        return updated;
    }
    mapTargetToScope(target) {
        switch (target) {
            case "routing_policy":
            case "planning_policy":
            case "execution_policy":
                return "policy";
            case "memory_policy":
                return "workflow";
            case "sandbox_policy":
                return "tool_config";
            case "provider_registry":
                return "model";
        }
    }
}
//# sourceMappingURL=improvement-candidate-registry.js.map