export type UnifiedRuntimeMode =
  | "full_auto"
  | "supervised_auto"
  | "read_only"
  | "no_write"
  | "no_external_call"
  | "no_rollout"
  | "manual_only"
  | "incident_mode";

export type HealthDegradationMode =
  | "none"
  | "queue_only"
  | "fast_only"
  | "pause_non_critical"
  | "read_only_operations_only";

export type PolicyRuntimeMode =
  | "supervised"
  | "auto"
  | "full-auto"
  | "read-only"
  | "maintenance"
  | "incident-mode"
  | "degraded"
  | "emergency";

export type InteractionAutonomyMode = "suggestion" | "supervised" | "semi_auto" | "full_auto" | "frozen";

export function mapPolicyModeToUnifiedRuntimeMode(mode: PolicyRuntimeMode): UnifiedRuntimeMode {
  switch (mode) {
    case "full-auto":
      return "full_auto";
    case "auto":
      return "supervised_auto";
    case "supervised":
      return "manual_only";
    case "read-only":
      return "read_only";
    case "maintenance":
      return "no_rollout";
    case "incident-mode":
      return "incident_mode";
    case "degraded":
      return "no_external_call";
    case "emergency":
      return "no_write";
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
