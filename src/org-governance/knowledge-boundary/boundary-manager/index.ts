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

export interface KnowledgeBoundaryInput {
  readonly boundaryId: string;
  readonly tenantId?: string | null;
  readonly ownerOrgNodeId: string;
  readonly namespaceIds?: readonly string[];
  readonly accessPolicy?: "strict" | "controlled";
  readonly defaultVisibility?: "private" | "shared" | "public";
  readonly auditOnAccess?: boolean;
  readonly allowedOrgNodeIds?: readonly string[];
  readonly fieldAllowlist?: readonly string[];
  readonly classificationRules?: readonly KnowledgeBoundaryClassificationRule[];
  readonly sharePolicy?: KnowledgeBoundarySharePolicy;
  readonly classification_rules?: readonly KnowledgeBoundaryClassificationRule[];
  readonly share_policy?: KnowledgeBoundarySharePolicy;
}
export interface KnowledgeBoundary {
  readonly boundaryId: string;
  readonly tenantId?: string | null;
  readonly ownerOrgNodeId: string;
  readonly namespaceIds?: readonly string[];
  readonly accessPolicy?: "strict" | "controlled";
  readonly defaultVisibility?: "private" | "shared" | "public";
  readonly auditOnAccess?: boolean;
  readonly allowedOrgNodeIds?: readonly string[];
  readonly fieldAllowlist?: readonly string[];
  readonly classificationRules?: readonly KnowledgeBoundaryClassificationRule[];
  readonly sharePolicy?: KnowledgeBoundarySharePolicy;
  readonly classification_rules?: readonly KnowledgeBoundaryClassificationRule[];
  readonly share_policy?: KnowledgeBoundarySharePolicy;
}
export type KnowledgeBoundaryClassificationRule = z.infer<typeof KnowledgeBoundaryClassificationRuleSchema>;
export type KnowledgeBoundarySharePolicy = z.infer<typeof KnowledgeBoundarySharePolicySchema>;

function normalizeKnowledgeBoundary(boundary: KnowledgeBoundaryInput): z.infer<typeof KnowledgeBoundarySchema> {
  return KnowledgeBoundarySchema.parse({
    ...boundary,
    namespaceIds: boundary.namespaceIds == null ? undefined : [...boundary.namespaceIds],
    allowedOrgNodeIds: boundary.allowedOrgNodeIds == null ? undefined : [...boundary.allowedOrgNodeIds],
    fieldAllowlist: boundary.fieldAllowlist == null ? undefined : [...boundary.fieldAllowlist],
    classificationRules: boundary.classificationRules == null ? undefined : [...boundary.classificationRules],
    classification_rules: boundary.classification_rules == null ? undefined : [...boundary.classification_rules],
    sharePolicy: boundary.sharePolicy,
    share_policy: boundary.share_policy,
  });
}

export function canAccessKnowledgeBoundary(boundary: KnowledgeBoundaryInput, requesterOrgNodeId: string): boolean {
  const normalizedBoundary = normalizeKnowledgeBoundary(boundary);
  const allowedOrgNodeIds = normalizedBoundary.allowedOrgNodeIds ?? [];
  const effectiveSharePolicy = resolveKnowledgeSharePolicy(boundary);
  if (normalizedBoundary.defaultVisibility === "public") {
    return true;
  }
  if (normalizedBoundary.ownerOrgNodeId === requesterOrgNodeId) {
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

export function resolveKnowledgeAccessPolicy(boundary: KnowledgeBoundaryInput): "strict" | "controlled" {
  const normalizedBoundary = normalizeKnowledgeBoundary(boundary);
  if (normalizedBoundary.accessPolicy != null) {
    return normalizedBoundary.accessPolicy;
  }
  return normalizedBoundary.defaultVisibility === "private" || normalizedBoundary.defaultVisibility == null
    ? "strict"
    : "controlled";
}

export function resolveKnowledgeClassificationRules(
  boundary: KnowledgeBoundaryInput,
): readonly KnowledgeBoundaryClassificationRule[] {
  const normalizedBoundary = normalizeKnowledgeBoundary(boundary);
  return normalizedBoundary.classificationRules.length > 0
    ? normalizedBoundary.classificationRules
    : normalizedBoundary.classification_rules ?? [];
}

export function resolveKnowledgeSharePolicy(boundary: KnowledgeBoundaryInput): KnowledgeBoundarySharePolicy {
  const normalizedBoundary = normalizeKnowledgeBoundary(boundary);
  return normalizedBoundary.sharePolicy ?? normalizedBoundary.share_policy ?? KnowledgeBoundarySharePolicySchema.parse({});
}
