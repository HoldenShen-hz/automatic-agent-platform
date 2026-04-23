export function mapHarnessStepToOapeflirPhase(role, stage) {
    if (stage === "plan" || role === "planner") {
        return "plan";
    }
    if (stage === "execute" || role === "generator") {
        return "execute";
    }
    if (stage === "evaluate" || role === "evaluator") {
        return "feedback";
    }
    if (role === "hitl_operator") {
        return "assess";
    }
    if (role === "loop_controller") {
        return "improve";
    }
    return "observe";
}
//# sourceMappingURL=oapeflir-harness-mapping.js.map