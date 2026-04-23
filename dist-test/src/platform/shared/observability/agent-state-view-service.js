import { nowIso, newId } from "../../contracts/types/ids.js";
export class AgentStateViewService {
    build(input) {
        return {
            viewId: newId("agent_state_view"),
            agentId: input.agentId,
            taskId: input.taskId,
            executionId: input.executionId ?? null,
            currentPhase: input.currentPhase,
            blockerCount: input.blockerSummaries?.length ?? 0,
            activeToolNames: [...(input.activeToolNames ?? [])],
            pendingApprovals: [...(input.pendingApprovals ?? [])],
            generatedAt: nowIso(),
        };
    }
}
//# sourceMappingURL=agent-state-view-service.js.map