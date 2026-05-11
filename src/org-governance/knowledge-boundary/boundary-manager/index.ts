import { z } from "zod";

export const KnowledgeBoundaryClassificationRuleSchema = z.object({
  ruleId: z.string().min(1),
  matchType: z.enum(["namespace", "tag", "field"]).default("namespace"),
  pattern: z.string().min(1),
  classification: z.enum(["public", "internal", "restricted", "secret"]).default("internal"),
});

export const KnowledgeBoundarySharePolicySchema = z.object({
  mode: z.enum(["deny_by_default", "explicit_grant", "org_allowlist"]).default("explicit_grant"),
  allowCrossTenant: z.boolean().default(false),
  requireAudit: z.boolean().default(true),
  allowOrgNodeIds: z.array(z.string().min(1)).default([]),
});

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
  classificationRules: z.array(KnowledgeBoundaryClassificationRuleSchema).default([]),
  sharePolicy: KnowledgeBoundarySharePolicySchema.default({}),
  classification_rules: z.array(KnowledgeBoundaryClassificationRuleSchema).optional(),
  share_policy: KnowledgeBoundarySharePolicySchema.optional(),
});

export type KnowledgeBoundary = z.infer<typeof KnowledgeBoundarySchema>;
export type KnowledgeBoundaryClassificationRule = z.infer<typeof KnowledgeBoundaryClassificationRuleSchema>;
export type KnowledgeBoundarySharePolicy = z.infer<typeof KnowledgeBoundarySharePolicySchema>;

export function canAccessKnowledgeBoundary(boundary: KnowledgeBoundary, requesterOrgNodeId: string): boolean {
  const allowedOrgNodeIds = boundary.allowedOrgNodeIds ?? [];
  const effectiveSharePolicy = resolveKnowledgeSharePolicy(boundary);
  if (boundary.defaultVisibility === "public") {
    return true;
  }
  if (boundary.ownerOrgNodeId === requesterOrgNodeId) {
    return true;
  }
  if (effectiveSharePolicy.mode === "org_allowlist" && effectiveSharePolicy.allowOrgNodeIds.includes(requesterOrgNodeId)) {
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

export function resolveKnowledgeClassificationRules(
  boundary: KnowledgeBoundary,
): readonly KnowledgeBoundaryClassificationRule[] {
  return boundary.classificationRules.length > 0
    ? boundary.classificationRules
    : boundary.classification_rules ?? [];
}

export function resolveKnowledgeSharePolicy(boundary: KnowledgeBoundary): KnowledgeBoundarySharePolicy {
  return boundary.sharePolicy ?? boundary.share_policy ?? KnowledgeBoundarySharePolicySchema.parse({});
}
