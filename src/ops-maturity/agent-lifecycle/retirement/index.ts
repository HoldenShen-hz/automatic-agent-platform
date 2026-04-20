export interface AgentRetirementPlan {
  readonly agentId: string;
  readonly successorAgentId: string | null;
  readonly revokeAt: string;
}

export function canRetireAgent(plan: AgentRetirementPlan, nowIso: string): boolean {
  return plan.revokeAt <= nowIso;
}
