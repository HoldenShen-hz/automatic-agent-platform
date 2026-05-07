import { z } from "zod";

export const KnowledgeBoundarySchema = z.object({
  boundaryId: z.string().min(1),
  tenantId: z.string().min(1).nullable().optional(),
  ownerOrgNodeId: z.string().min(1),
  namespaceIds: z.array(z.string()).default([]),
  accessPolicy: z.enum(["strict", "controlled"]).optional(),
  defaultVisibility: z.enum(["private", "shared", "public"]).optional(),
  auditOnAccess: z.boolean().default(true),
  allowedOrgNodeIds: z.array(z.string()).default([]),
  fieldAllowlist: z.array(z.string()).default([]),
});

export type KnowledgeBoundary = z.infer<typeof KnowledgeBoundarySchema>;

export function canAccessKnowledgeBoundary(boundary: KnowledgeBoundary, requesterOrgNodeId: string): boolean {
  const allowedOrgNodeIds = boundary.allowedOrgNodeIds ?? [];
  if (boundary.ownerOrgNodeId === requesterOrgNodeId) {
    return true;
  }
  if (allowedOrgNodeIds.includes(requesterOrgNodeId)) {
    return true;
  }
  return false;
}

export function resolveKnowledgeAccessPolicy(boundary: KnowledgeBoundary): "strict" | "controlled" {
  if (boundary.accessPolicy != null) {
    return boundary.accessPolicy;
  }
  return boundary.defaultVisibility === "private" || boundary.defaultVisibility == null
    ? "strict"
    : "controlled";
}
