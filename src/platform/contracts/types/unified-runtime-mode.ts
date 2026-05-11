export type UnifiedRuntimeMode =
  | "full_auto"
  | "supervised_auto"
  | "read_only"
  | "no_write"
  | "no_external_call"
  | "no_rollout"
  | "manual_only"
  | "incident_mode";

export type DocumentedUnifiedRuntimeMode =
  | "full-auto"
  | "supervised-auto"
  | "read-only"
  | "no-write"
  | "no-external-call"
  | "no-rollout"
  | "manual-only"
  | "incident-mode";

export type HealthDegradationMode =
  | "none"
  | "queue_only"
  | "fast_only"
  | "pause_non_critical"
  | "read_only_operations_only";

export type PolicyRuntimeMode =
  | "auto"
  | "full-auto"
  | "read-only"
  | "incident-mode";

export type InteractionAutonomyMode = "suggestion" | "supervised" | "semi_auto" | "full_auto" | "frozen";

export function mapPolicyModeToUnifiedRuntimeMode(mode: PolicyRuntimeMode): UnifiedRuntimeMode {
  switch (mode) {
    case "full-auto":
      return "full_auto";
    case "auto":
      return "supervised_auto";
    case "read-only":
      return "read_only";
    case "incident-mode":
      return "incident_mode";
    default:
      return "manual_only";
  }
}

export function mapHealthDegradationModeToUnifiedRuntimeMode(mode: HealthDegradationMode): UnifiedRuntimeMode {
  switch (mode) {
    case "none":
      return "full_auto";
    case "fast_only":
      return "supervised_auto";
    case "queue_only":
      return "no_external_call";
    case "pause_non_critical":
      return "manual_only";
    case "read_only_operations_only":
      return "read_only";
    default:
      return "manual_only";
  }
}

export function mapAutonomyLevelToUnifiedRuntimeMode(level: InteractionAutonomyMode): UnifiedRuntimeMode {
  switch (level) {
    case "full_auto":
      return "full_auto";
    case "semi_auto":
      return "supervised_auto";
    case "supervised":
      return "manual_only";
    case "suggestion":
      return "no_write";
    case "frozen":
      return "incident_mode";
    default:
      return "manual_only";
  }
}

export function normalizeUnifiedRuntimeMode(mode: UnifiedRuntimeMode | DocumentedUnifiedRuntimeMode): UnifiedRuntimeMode {
  switch (mode) {
    case "full-auto":
      return "full_auto";
    case "supervised-auto":
      return "supervised_auto";
    case "read-only":
      return "read_only";
    case "no-write":
      return "no_write";
    case "no-external-call":
      return "no_external_call";
    case "no-rollout":
      return "no_rollout";
    case "manual-only":
      return "manual_only";
    case "incident-mode":
      return "incident_mode";
    default:
      return mode;
  }
}

export function toDocumentedUnifiedRuntimeMode(mode: UnifiedRuntimeMode): DocumentedUnifiedRuntimeMode {
  switch (mode) {
    case "full_auto":
      return "full-auto";
    case "supervised_auto":
      return "supervised-auto";
    case "read_only":
      return "read-only";
    case "no_write":
      return "no-write";
    case "no_external_call":
      return "no-external-call";
    case "no_rollout":
      return "no-rollout";
    case "manual_only":
      return "manual-only";
    case "incident_mode":
      return "incident-mode";
  }
}
