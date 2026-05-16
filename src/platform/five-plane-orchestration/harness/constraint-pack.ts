import {
  mapAutonomyLevelToUnifiedRuntimeMode,
  normalizeUnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../../platform/contracts/types/unified-runtime-mode.js";

export interface ConstraintToolPolicy {
  readonly allowedTools: readonly string[];
}

export interface ConstraintRiskPolicy {
  readonly maxRiskScore: number;
  readonly escalationThreshold: number;
}

export interface ConstraintOutputPolicy {
  readonly requiredEvidence: readonly string[];
  readonly redactSensitiveData: boolean;
}

export interface ConstraintSandboxRequirement {
  readonly sandboxMode: "none" | "ephemeral" | "persistent" | "network_isolated";
  readonly timeoutMs: number;
  readonly allowedHosts?: readonly string[];
}

export interface ConstraintApprovalRequirement {
  readonly requiredForRiskClass: readonly ("low" | "medium" | "high" | "critical")[];
  readonly approverRoles: readonly string[];
  readonly escalationTimeoutMs: number;
}

export interface ConstraintBudgetEnvelope {
  readonly maxSteps: number;
  readonly maxCost: number;
  readonly maxDurationMs: number;
  readonly maxTokens?: number;
  /** @deprecated Use maxModelTokens/maxContextTokens/maxOutputTokens directly */
  readonly maxModelTokens?: number;
  readonly maxContextTokens?: number;
  readonly maxOutputTokens?: number;
}

export interface ConstraintPack {
  readonly policyIds: readonly string[];
  readonly approvalMode: "none" | "required" | "supervised";
  readonly autonomyMode:
    | "suggestion"
    | "supervised"
    | "semi_auto"
    | "full_auto"
    | UnifiedRuntimeMode
    | DocumentedUnifiedRuntimeMode;
  readonly tool_policy: ConstraintToolPolicy;
  readonly risk_policy?: ConstraintRiskPolicy;
  readonly output_policy?: ConstraintOutputPolicy;
  readonly budgetEnvelope?: ConstraintBudgetEnvelope;
  readonly sandboxRequirement: ConstraintSandboxRequirement;
  readonly approvalRequirement: ConstraintApprovalRequirement;
  /** @deprecated Use budgetEnvelope or budget_envelope */
  readonly budget?: {
    readonly maxSteps: number;
    readonly maxCost: number;
    readonly maxDurationMs: number;
    readonly maxModelTokens?: number;
    readonly maxContextTokens?: number;
    readonly maxOutputTokens?: number;
    readonly max_model_tokens?: number;
    readonly max_context_tokens?: number;
    readonly max_output_tokens?: number;
  };
  readonly versionLockRef?: string;
}

export function getConstraintRiskPolicy(constraintPack: ConstraintPack): ConstraintRiskPolicy {
  const riskPolicy = constraintPack.risk_policy;
  if (riskPolicy == null) {
    throw new Error("harness.constraint_pack.missing_risk_policy");
  }
  return riskPolicy;
}

export function getConstraintOutputPolicy(constraintPack: ConstraintPack): ConstraintOutputPolicy {
  const outputPolicy = constraintPack.output_policy;
  if (outputPolicy == null) {
    throw new Error("harness.constraint_pack.missing_output_policy");
  }
  return outputPolicy;
}

export function normalizeConstraintPack(input: ConstraintPack): ConstraintPack {
  const riskPolicy = input.risk_policy ?? { maxRiskScore: 0.8, escalationThreshold: 0.7 };
  const outputPolicy = input.output_policy ?? { requiredEvidence: [], redactSensitiveData: false };
  const budgetEnvelope = input.budgetEnvelope ?? input.budget;
  const legacyBudget = input.budget;
  const legacyToolPolicy = (input as { toolPolicy?: ConstraintToolPolicy }).toolPolicy;
  const toolPolicy = input.tool_policy ?? legacyToolPolicy ?? { allowedTools: [] };

  const partial: {
    policyIds: readonly string[];
    approvalMode: "none" | "required" | "supervised";
    autonomyMode: ConstraintPack["autonomyMode"];
    tool_policy: { allowedTools: readonly string[] };
    risk_policy: { maxRiskScore: number; escalationThreshold: number };
    output_policy: { requiredEvidence: readonly string[]; redactSensitiveData: boolean };
    sandboxRequirement?: ConstraintSandboxRequirement;
    approvalRequirement?: ConstraintApprovalRequirement;
    budgetEnvelope?: ConstraintBudgetEnvelope;
    budget?: {
      maxSteps: number;
      maxCost: number;
      maxDurationMs: number;
      maxModelTokens?: number;
      maxContextTokens?: number;
      maxOutputTokens?: number;
      max_model_tokens?: number;
      max_context_tokens?: number;
      max_output_tokens?: number;
    };
  } = {
    policyIds: input.policyIds ? [...input.policyIds] : [],
    approvalMode: input.approvalMode ?? "none",
    autonomyMode: normalizeConstraintPackAutonomyMode(input.autonomyMode ?? "semi_auto"),
    tool_policy: {
      allowedTools: toolPolicy.allowedTools ? [...toolPolicy.allowedTools] : [],
    },
    risk_policy: {
      maxRiskScore: riskPolicy.maxRiskScore,
      escalationThreshold: riskPolicy.escalationThreshold,
    },
    output_policy: {
      requiredEvidence: [...outputPolicy.requiredEvidence],
      redactSensitiveData: outputPolicy.redactSensitiveData,
    },
  };

  const sandboxRequirement = input.sandboxRequirement;
  if (sandboxRequirement != null) {
    partial.sandboxRequirement = sandboxRequirement;
  }
  const approvalRequirement = input.approvalRequirement;
  if (approvalRequirement != null) {
    partial.approvalRequirement = approvalRequirement;
  }
  if (budgetEnvelope != null) {
    partial.budget = input.budget == null && input.budgetEnvelope != null
      ? {
          maxSteps: budgetEnvelope.maxSteps,
          maxCost: budgetEnvelope.maxCost,
          maxDurationMs: budgetEnvelope.maxDurationMs,
        }
      : { ...legacyBudget! };
    if ("maxTokens" in budgetEnvelope && budgetEnvelope.maxTokens != null) {
      partial.budget.maxModelTokens = budgetEnvelope.maxTokens as number;
      partial.budget.maxContextTokens = budgetEnvelope.maxTokens as number;
      partial.budget.maxOutputTokens = budgetEnvelope.maxTokens as number;
      partial.budget.max_model_tokens = budgetEnvelope.maxTokens as number;
      partial.budget.max_context_tokens = budgetEnvelope.maxTokens as number;
      partial.budget.max_output_tokens = budgetEnvelope.maxTokens as number;
    }
    if ("maxModelTokens" in budgetEnvelope && budgetEnvelope.maxModelTokens != null) {
      partial.budget.maxModelTokens = budgetEnvelope.maxModelTokens;
      partial.budget.max_model_tokens = budgetEnvelope.maxModelTokens;
    }
    if ("maxContextTokens" in budgetEnvelope && budgetEnvelope.maxContextTokens != null) {
      partial.budget.maxContextTokens = budgetEnvelope.maxContextTokens;
      partial.budget.max_context_tokens = budgetEnvelope.maxContextTokens;
    }
    if ("maxOutputTokens" in budgetEnvelope && budgetEnvelope.maxOutputTokens != null) {
      partial.budget.maxOutputTokens = budgetEnvelope.maxOutputTokens;
      partial.budget.max_output_tokens = budgetEnvelope.maxOutputTokens;
    }
    if (legacyBudget?.maxModelTokens != null) {
      partial.budget.maxModelTokens = legacyBudget.maxModelTokens;
      partial.budget.max_model_tokens = legacyBudget.maxModelTokens;
    }
    if (legacyBudget?.max_model_tokens != null) {
      partial.budgetEnvelope = {
        ...(partial.budgetEnvelope ?? {
          maxSteps: budgetEnvelope.maxSteps,
          maxCost: budgetEnvelope.maxCost,
          maxDurationMs: budgetEnvelope.maxDurationMs,
        }),
        maxModelTokens: legacyBudget.max_model_tokens,
      };
    }
    if (legacyBudget?.maxContextTokens != null) {
      partial.budget.maxContextTokens = legacyBudget.maxContextTokens;
      partial.budget.max_context_tokens = legacyBudget.maxContextTokens;
    }
    if (legacyBudget?.max_context_tokens != null) {
      partial.budgetEnvelope = {
        ...(partial.budgetEnvelope ?? {
          maxSteps: budgetEnvelope.maxSteps,
          maxCost: budgetEnvelope.maxCost,
          maxDurationMs: budgetEnvelope.maxDurationMs,
        }),
        maxContextTokens: legacyBudget.max_context_tokens,
      };
    }
    if (legacyBudget?.maxOutputTokens != null) {
      partial.budget.maxOutputTokens = legacyBudget.maxOutputTokens;
      partial.budget.max_output_tokens = legacyBudget.maxOutputTokens;
    }
    if (legacyBudget?.max_output_tokens != null) {
      partial.budgetEnvelope = {
        ...(partial.budgetEnvelope ?? {
          maxSteps: budgetEnvelope.maxSteps,
          maxCost: budgetEnvelope.maxCost,
          maxDurationMs: budgetEnvelope.maxDurationMs,
        }),
        maxOutputTokens: legacyBudget.max_output_tokens,
      };
    }
    partial.budgetEnvelope = {
      maxSteps: budgetEnvelope.maxSteps,
      maxCost: budgetEnvelope.maxCost,
      maxDurationMs: budgetEnvelope.maxDurationMs,
      ...("maxTokens" in budgetEnvelope && budgetEnvelope.maxTokens != null
        ? { maxTokens: budgetEnvelope.maxTokens as number }
        : {}),
      ...("maxModelTokens" in budgetEnvelope && budgetEnvelope.maxModelTokens != null
        ? { maxModelTokens: budgetEnvelope.maxModelTokens }
        : {}),
      ...("maxContextTokens" in budgetEnvelope && budgetEnvelope.maxContextTokens != null
        ? { maxContextTokens: budgetEnvelope.maxContextTokens }
        : {}),
      ...("maxOutputTokens" in budgetEnvelope && budgetEnvelope.maxOutputTokens != null
        ? { maxOutputTokens: budgetEnvelope.maxOutputTokens }
        : {}),
      ...(legacyBudget?.maxModelTokens != null
        ? { maxModelTokens: legacyBudget.maxModelTokens }
        : {}),
      ...(legacyBudget?.maxContextTokens != null
        ? { maxContextTokens: legacyBudget.maxContextTokens }
        : {}),
      ...(legacyBudget?.maxOutputTokens != null
        ? { maxOutputTokens: legacyBudget.maxOutputTokens }
        : {}),
      ...(legacyBudget?.max_model_tokens != null
        ? { maxModelTokens: legacyBudget.max_model_tokens }
        : {}),
      ...(legacyBudget?.max_context_tokens != null
        ? { maxContextTokens: legacyBudget.max_context_tokens }
        : {}),
      ...(legacyBudget?.max_output_tokens != null
        ? { maxOutputTokens: legacyBudget.max_output_tokens }
        : {}),
    };
    if (input.budget == null && input.budgetEnvelope != null) {
      delete partial.budget.maxModelTokens;
      delete partial.budget.maxContextTokens;
      delete partial.budget.maxOutputTokens;
    }
  }

  return partial as ConstraintPack;
}

export function normalizeConstraintPackAutonomyMode(
  autonomyMode: ConstraintPack["autonomyMode"],
): UnifiedRuntimeMode {
  switch (autonomyMode) {
    case "suggestion":
    case "supervised":
    case "semi_auto":
    case "full_auto":
      return mapAutonomyLevelToUnifiedRuntimeMode(autonomyMode);
    default:
      return normalizeUnifiedRuntimeMode(autonomyMode);
  }
}
