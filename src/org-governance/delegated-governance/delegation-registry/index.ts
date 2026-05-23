import { z } from "zod";

/**
 * Governance permissions as defined in architecture doc §51.1.
 */
export const GovernancePermissionSchema = z.enum([
  "manage_domains",
  "manage_packs",
  "manage_prompts",
  "manage_triggers",
  "manage_approvals",
  "manage_budgets",
  "manage_knowledge",
  "view_audit",
  "manage_agents",
  "manage_eval",
]);

export type GovernancePermission = z.infer<typeof GovernancePermissionSchema>;

export const GovernanceDelegationLevelSchema = z.enum(["view", "operate", "admin", "super_admin"]);

export type GovernanceDelegationLevel = z.infer<typeof GovernanceDelegationLevelSchema>;

/**
 * Guardrail type enum as defined in architecture doc §51.1.
 */
export const GuardrailTypeSchema = z.enum([
  "max_risk_level",
  "max_budget",
  "forbidden_tools",
  "mandatory_approval",
  "min_eval_threshold",
]);

export type GuardrailType = z.infer<typeof GuardrailTypeSchema>;

/**
 * Guardrail set by platform team - cannot be overridden.
 * As defined in architecture doc §51.1.
 */
export const GuardrailSchema = z.object({
  guardrailId: z.string().min(1),
  type: GuardrailTypeSchema,
  value: z.unknown(),
  setBy: z.enum(["platform_team"]).default("platform_team"),
  overridable: z.literal(false).default(false as const),
});

export interface Guardrail {
  readonly guardrailId: string;
  readonly type: GuardrailType;
  readonly value?: unknown;
  readonly setBy?: "platform_team";
  readonly overridable?: false;
}

/**
 * Governance delegation - assigns permissions to a grantee within an org node.
 * As defined in architecture doc §51.1.
 */
export const GovernanceDelegationSchema = z.object({
  delegationId: z.string().min(1),
  grantorId: z.string().min(1),
  granteeId: z.string().min(1),
  level: GovernanceDelegationLevelSchema.default("view"),
  delegatable: z.boolean().default(false),
  /** Org nodes where this delegation applies (empty = all) */
  orgNodeIds: z.array(z.string()).default([]),
  /** Domains where this delegation applies (empty = all) */
  domainIds: z.array(z.string()).default([]),
  derivedDelegationIds: z.array(z.string().min(1)).default([]),
  /** Specific governance permissions granted */
  permissions: z.array(GovernancePermissionSchema).default([]),
  /** Platform team-set guardrails (non-overridable) */
  guardrails: z.array(GuardrailSchema).default([]),
  expiresAt: z.string().min(1),
  revocable: z.boolean().default(true),
  status: z.enum(["active", "revoked", "expired", "inactive"]).default("active").transform((status) =>
    status === "inactive" ? "revoked" : status
  ),
});

export interface GovernanceDelegation {
  readonly delegationId: string;
  readonly grantorId: string;
  readonly granteeId: string;
  readonly level?: GovernanceDelegationLevel;
  readonly delegatable?: boolean;
  readonly orgNodeIds?: readonly string[];
  readonly domainIds?: readonly string[];
  readonly derivedDelegationIds?: readonly string[];
  readonly permissions?: readonly string[];
  readonly guardrails?: readonly Guardrail[];
  readonly expiresAt: string;
  readonly revocable?: boolean;
  readonly status?: "active" | "revoked" | "expired" | "inactive";
}
export interface NormalizedGovernanceDelegation {
  readonly delegationId: string;
  readonly grantorId: string;
  readonly granteeId: string;
  readonly level: GovernanceDelegationLevel;
  readonly delegatable: boolean;
  readonly orgNodeIds: readonly string[];
  readonly domainIds: readonly string[];
  readonly derivedDelegationIds: readonly string[];
  readonly permissions: readonly GovernancePermission[];
  readonly guardrails: readonly Guardrail[];
  readonly expiresAt: string;
  readonly revocable: boolean;
  readonly status: "active" | "revoked" | "expired";
}
export type GovernanceDelegationInput = GovernanceDelegation;

export function normalizeGovernanceDelegation(input: GovernanceDelegationInput): NormalizedGovernanceDelegation {
  return GovernanceDelegationSchema.parse(input);
}

export function listActiveGovernanceDelegations(
  delegations: readonly GovernanceDelegationInput[],
  nowIso: string,
): NormalizedGovernanceDelegation[] {
  return delegations
    .map((item) => normalizeGovernanceDelegation(item))
    .filter((item) => item.status === "active" && item.expiresAt >= nowIso);
}
