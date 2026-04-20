import { nowIso, newId } from "../../contracts/types/ids.js";

export interface AgentStateViewInput {
  agentId: string;
  taskId: string;
  executionId?: string | null;
  currentPhase: string;
  blockerSummaries?: readonly string[];
  activeToolNames?: readonly string[];
  pendingApprovals?: readonly string[];
}

export interface AgentStateView {
  viewId: string;
  agentId: string;
  taskId: string;
  executionId: string | null;
  currentPhase: string;
  blockerCount: number;
  activeToolNames: string[];
  pendingApprovals: string[];
  generatedAt: string;
}

export class AgentStateViewService {
  public build(input: AgentStateViewInput): AgentStateView {
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
