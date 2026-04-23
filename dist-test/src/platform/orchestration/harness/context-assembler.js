import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
export class ContextAssembler {
    assemble(sources, tokenBudget) {
        return {
            contextId: newId("harness_context"),
            tokenBudget,
            conversation: { ...(sources.conversation ?? {}) },
            task: { ...(sources.task ?? {}) },
            memory: { ...(sources.memory ?? {}) },
            knowledge: { ...(sources.knowledge ?? {}) },
            assembledAt: nowIso(),
        };
    }
    snapshot(run, context) {
        return {
            snapshotId: newId("ctx_snapshot"),
            runId: run.runId,
            domainId: run.domainId,
            iteration: run.currentIteration,
            stepCount: run.steps.length,
            lastDecisionId: run.decision?.decisionId ?? null,
            capturedAt: context.assembledAt,
        };
    }
}
//# sourceMappingURL=context-assembler.js.map