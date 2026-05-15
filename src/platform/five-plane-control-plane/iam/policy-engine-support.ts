import { ValidationError } from "../../contracts/errors.js";
import {
  normalizeUnifiedRuntimeMode,
  type DocumentedUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../contracts/types/unified-runtime-mode.js";
import type { PolicyAction, PolicyDecisionRequest, PolicyMode } from "./policy-engine-model.js";

export const MUTATING_POLICY_ACTIONS: readonly PolicyAction[] = [
  "invoke_tool",
  "write_file",
  "exec_command",
  "install_extension",
  "org_change",
  "dispatch_execution",
  "set_isolation_level",
  "promote_improvement",
  "advance_rollout",
  "modify_knowledge_trust",
  "promote_memory_layer",
];

export function normalizePolicyMode(mode: PolicyMode): UnifiedRuntimeMode {
  switch (mode) {
    case "supervised":
      return "supervised_auto";
    case "auto":
      return "supervised_auto";
    default:
      return normalizeUnifiedRuntimeMode(mode as UnifiedRuntimeMode | DocumentedUnifiedRuntimeMode);
  }
}

/** Map of actions to required roles for execution */
export const ACTION_REQUIRED_ROLES: Record<PolicyAction, readonly string[]> = {
  invoke_model: ["model_invoker", "agent"],
  invoke_tool: ["tool_executor", "agent"],
  write_file: ["file_writer", "agent"],
  exec_command: ["command_executor", "agent"],
  network_access: ["network_access", "agent"],
  install_extension: ["extension_manager", "admin"],
  org_change: ["org_admin", "admin"],
  dispatch_execution: ["execution_dispatcher", "agent"],
  set_isolation_level: ["isolation_manager", "admin"],
  promote_improvement: ["promotion_manager", "agent"],
  advance_rollout: ["rollout_manager", "admin"],
  modify_knowledge_trust: ["knowledge_manager", "agent"],
  promote_memory_layer: ["memory_manager", "agent"],
};

/**
 * Map of actions to required capabilities.
 * Uses platform capability naming (colon notation) to align with PlatformCapability
 * type in access-model.ts (e.g., "exec:command" not "command.execute").
 * This ensures evaluate() properly validates subject capabilities against
 * the platform's role→capability model.
 */
export const ACTION_REQUIRED_CAPABILITIES: Record<PolicyAction, readonly string[]> = {
  invoke_model: ["model:invoke"],
  invoke_tool: ["tool:invoke"],
  write_file: ["fs:write"],
  exec_command: ["exec:command"],
  network_access: ["network:access"],
  install_extension: ["extension:install"],
  org_change: ["org:change"],
  dispatch_execution: ["execution:dispatch"],
  set_isolation_level: ["execution:dispatch"],
  promote_improvement: ["improvement:promote"],
  advance_rollout: ["rollout:advance"],
  modify_knowledge_trust: ["knowledge:trust:modify"],
  promote_memory_layer: ["memory:promote"],
};

export const LEGACY_CAPABILITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "model:invoke": ["model.call"],
  "tool:invoke": ["tool.execute"],
  "fs:write": ["file.write"],
  "exec:command": ["command.execute", "command.execute.shell"],
  "network:access": ["network.access"],
  "extension:install": ["extension.install"],
  "org:change": ["org.change"],
  "execution:dispatch": ["execution.dispatch"],
  "improvement:promote": ["improvement.promote"],
  "rollout:advance": ["rollout.advance"],
  "knowledge:trust:modify": ["knowledge.trust.modify"],
  "memory:promote": ["memory.promote"],
};

export const LEGACY_CAPABILITY_TO_CANONICAL = new Map<string, string>(
  Object.entries(LEGACY_CAPABILITY_ALIASES).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [alias, canonical] as const),
  ),
);

export function resolveSubjectRoles(input: PolicyDecisionRequest): readonly string[] {
  if (input.subjectRoles !== undefined) {
    return input.subjectRoles;
  }
  return ACTION_REQUIRED_ROLES[input.action] ?? [];
}

export function resolveSubjectCapabilities(input: PolicyDecisionRequest): readonly string[] {
  if (input.subjectCapabilities === undefined) {
    return ACTION_REQUIRED_CAPABILITIES[input.action] ?? [];
  }

  const normalizedCapabilities = new Set<string>();
  for (const capability of input.subjectCapabilities) {
    normalizedCapabilities.add(capability);
    const canonicalCapability = LEGACY_CAPABILITY_TO_CANONICAL.get(capability);
    if (canonicalCapability != null) {
      normalizedCapabilities.add(canonicalCapability);
    }
  }

  return [...normalizedCapabilities];
}

/**
 * Validates that the subject has required roles and capabilities for the action.
 * Uses OR logic: the subject must have at least ONE of the required roles AND
 * at least ONE of the required capabilities (if any are specified).
 * Throws ValidationError if the subject lacks all required permissions.
 */
export function validateSubjectPermissions(input: PolicyDecisionRequest): void {
  const requiredRoles = ACTION_REQUIRED_ROLES[input.action] ?? [];
  const requiredCapabilities = ACTION_REQUIRED_CAPABILITIES[input.action] ?? [];
  const subjectRoles = resolveSubjectRoles(input);
  const subjectCapabilities = resolveSubjectCapabilities(input);

  // OR logic: subject must have at least one of the required roles
  const hasAtLeastOneRole = requiredRoles.some((role) => subjectRoles.includes(role));
  if (requiredRoles.length > 0 && !hasAtLeastOneRole) {
    const missingRoles = requiredRoles.filter((role) => !subjectRoles.includes(role));
    throw new ValidationError(
      "policy.subject_missing_roles",
      `Subject lacks required roles for action '${input.action}': [${missingRoles.join(", ")}]`,
      {
        details: {
          subjectId: input.subjectId,
          subjectType: input.subjectType,
          action: input.action,
          missingRoles,
          requiredRoles,
        },
      },
    );
  }

  // OR logic: subject must have at least one of the required capabilities
  const hasAtLeastOneCapability = requiredCapabilities.some((cap) => subjectCapabilities.includes(cap));
  if (requiredCapabilities.length > 0 && !hasAtLeastOneCapability) {
    const missingCapabilities = requiredCapabilities.filter((cap) => !subjectCapabilities.includes(cap));
    throw new ValidationError(
      "policy.subject_missing_capabilities",
      `Subject lacks required capabilities for action '${input.action}': [${missingCapabilities.join(", ")}]`,
      {
        details: {
          subjectId: input.subjectId,
          subjectType: input.subjectType,
          action: input.action,
          missingCapabilities,
          requiredCapabilities,
        },
      },
    );
  }
}

/**
 * Validates PolicyDecisionRequest input fields.
 * V-01: Critical API endpoints must validate input to prevent malformed data.
 */
export function validatePolicyRequest(input: PolicyDecisionRequest): void {
  if (!input.decisionId || typeof input.decisionId !== "string" || input.decisionId.trim().length === 0) {
    throw new ValidationError("policy.invalid_decision_id", "Policy decision request must have a non-empty decisionId", {
      details: { decisionId: input.decisionId },
    });
  }
  if (!input.taskId || typeof input.taskId !== "string" || input.taskId.trim().length === 0) {
    throw new ValidationError("policy.invalid_task_id", "Policy decision request must have a non-empty taskId", {
      details: { taskId: input.taskId },
    });
  }
  if (!input.subjectId || typeof input.subjectId !== "string" || input.subjectId.trim().length === 0) {
    throw new ValidationError("policy.invalid_subject_id", "Policy decision request must have a non-empty subjectId", {
      details: { subjectId: input.subjectId },
    });
  }
  if (!input.action || typeof input.action !== "string") {
    throw new ValidationError("policy.invalid_action", "Policy decision request must have a valid action", {
      details: { action: input.action },
    });
  }
  if (!input.riskCategory || typeof input.riskCategory !== "string") {
    throw new ValidationError("policy.invalid_risk_category", "Policy decision request must have a valid risk category", {
      details: { riskCategory: input.riskCategory },
    });
  }
  if (!input.mode || typeof input.mode !== "string") {
    throw new ValidationError("policy.invalid_mode", "Policy decision request must have a valid mode", {
      details: { mode: input.mode },
    });
  }
}
