export class PlanDagValidator {
    validate(steps) {
        const stepById = new Map(steps.map((step) => [step.stepId, step]));
        const issues = [];
        const incomingCounts = new Map();
        const outgoing = new Map();
        for (const step of steps) {
            incomingCounts.set(step.stepId, 0);
            outgoing.set(step.stepId, []);
        }
        for (const step of steps) {
            for (const dependencyId of step.dependencies) {
                if (dependencyId === step.stepId) {
                    issues.push(`planning.self_dependency:${step.stepId}`);
                    continue;
                }
                if (!stepById.has(dependencyId)) {
                    issues.push(`planning.missing_dependency:${step.stepId}:${dependencyId}`);
                    continue;
                }
                incomingCounts.set(step.stepId, (incomingCounts.get(step.stepId) ?? 0) + 1);
                outgoing.get(dependencyId)?.push(step.stepId);
            }
        }
        const readyQueue = steps
            .filter((step) => (incomingCounts.get(step.stepId) ?? 0) === 0)
            .map((step) => step.stepId);
        const orderedSteps = [];
        while (readyQueue.length > 0) {
            const nextStepId = readyQueue.shift();
            const nextStep = stepById.get(nextStepId);
            if (!nextStep) {
                continue;
            }
            orderedSteps.push(nextStep);
            for (const dependentId of outgoing.get(nextStepId) ?? []) {
                const nextIncoming = (incomingCounts.get(dependentId) ?? 0) - 1;
                incomingCounts.set(dependentId, nextIncoming);
                if (nextIncoming === 0) {
                    readyQueue.push(dependentId);
                }
            }
        }
        if (orderedSteps.length !== steps.length) {
            issues.push("planning.cycle_detected");
        }
        return {
            valid: issues.length === 0,
            issues,
            orderedSteps: orderedSteps.length === steps.length ? orderedSteps : [...steps],
        };
    }
}
//# sourceMappingURL=plan-dag-validator.js.map