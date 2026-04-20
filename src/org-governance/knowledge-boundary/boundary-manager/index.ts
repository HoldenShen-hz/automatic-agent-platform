import { z } from "zod";

export const KnowledgeBoundarySchema = z.object({
  boundaryId: z.string().min(1),
  ownerOrgNodeId: z.string().min(1),
  namespaceIds: z.array(z.string()).default([]),
  defaultVisibility: z.enum(["private", "shared", "public"]).default("private"),
  allowedOrgNodeIds: z.array(z.string()).default([]),
});

export type KnowledgeBoundary = z.infer<typeof KnowledgeBoundarySchema>;

export function canAccessKnowledgeBoundary(boundary: KnowledgeBoundary, requesterOrgNodeId: string): boolean {
  return boundary.defaultVisibility === "public"
    || boundary.ownerOrgNodeId === requesterOrgNodeId
    || boundary.allowedOrgNodeIds.includes(requesterOrgNodeId);
}
