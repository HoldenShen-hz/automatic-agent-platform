import { z } from "zod";

export const AgentVersionSchema = z.object({
  versionId: z.string().min(1),
  agentId: z.string().min(1),
  createdAt: z.string().min(1),
  stable: z.boolean().default(false),
});

export type AgentVersion = z.infer<typeof AgentVersionSchema>;

export function resolveLatestAgentVersion(versions: readonly AgentVersion[]): AgentVersion | null {
  return [...versions].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}
