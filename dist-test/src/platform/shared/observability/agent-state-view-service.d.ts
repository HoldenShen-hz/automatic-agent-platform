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
export declare class AgentStateViewService {
    build(input: AgentStateViewInput): AgentStateView;
}
