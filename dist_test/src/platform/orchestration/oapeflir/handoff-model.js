import { nowIso, newId } from "../../contracts/types/ids.js";
function estimatedTokens(value) {
    return Math.ceil(JSON.stringify(value).length / 4);
}
export function createAgentHandoff(input) {
    return {
        ...input,
        handoffId: newId("handoff"),
        createdAt: nowIso(),
    };
}
export function compactAgentHandoff(handoff, options) {
    const clone = JSON.parse(JSON.stringify(handoff));
    let size = estimatedTokens(clone);
    if (size <= options.totalMaxTokens) {
        return clone;
    }
    clone.fact.toolCallRecords = [];
    size = estimatedTokens(clone);
    if (size <= options.totalMaxTokens) {
        return clone;
    }
    clone.planDelta.removedSteps = [];
    clone.planDelta.changedSteps = [];
    size = estimatedTokens(clone);
    if (size <= options.totalMaxTokens) {
        return clone;
    }
    clone.state = {
        ...clone.state,
        latestSummary: "",
        blockers: clone.state.blockers.slice(0, 3),
    };
    size = estimatedTokens(clone);
    if (size <= options.totalMaxTokens) {
        return clone;
    }
    clone.primaryRefs = clone.primaryRefs.slice(0, 3);
    clone.fact.artifactRefs = clone.fact.artifactRefs.slice(0, 3);
    return clone;
}
//# sourceMappingURL=handoff-model.js.map