import { z } from "zod";

export const AgentDefinitionSchema = z.object({
  agentId: z.string().min(1),
  domainId: z.string().min(1),
  lifecycleState: z.enum(["draft", "validated", "canary", "active", "deprecated", "retired"]),
  currentVersionId: z.string().min(1),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export function listActiveAgents(agents: readonly AgentDefinition[]): AgentDefinition[] {
  return agents.filter((item) => item.lifecycleState === "active" || item.lifecycleState === "canary");
}
