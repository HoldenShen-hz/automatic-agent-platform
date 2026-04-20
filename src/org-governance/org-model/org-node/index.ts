import { z } from "zod";

export const OrgNodeTypeSchema = z.enum(["enterprise", "business_unit", "department", "team", "seat"]);

export const OrgNodeSchema = z.object({
  orgNodeId: z.string().min(1),
  nodeType: OrgNodeTypeSchema,
  displayName: z.string().min(1),
  parentOrgNodeId: z.string().min(1).nullable().default(null),
  ownerUserIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export type OrgNodeType = z.infer<typeof OrgNodeTypeSchema>;
export type OrgNode = z.infer<typeof OrgNodeSchema>;

export function isLeafOrgNode(node: OrgNode): boolean {
  return node.nodeType === "seat";
}
