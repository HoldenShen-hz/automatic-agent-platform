import type { AnomalySeverity } from "../../shared/observability/anomaly-detection-service.js";

export type EscalationLevel = "observe" | "warn" | "act" | "critical";

export type StopLossAction =
  | "circuit_break"
  | "isolate_provider"
  | "scale_down"
  | "pause_non_critical"
  | "queue_only"
  | "reject_low_priority"
  | "enable_circuit_breaker"
  | "disable_new_tasks"
  | "force_garbage_collection"
  | "escalate_to_human";

export interface StopLossPlaybook {
  id: string;
  name: string;
  description: string;
  triggerCondition: PlaybookCondition;
  actions: StopLossAction[];
  cooldownMs: number;
  maxExecutionsPerHour: number;
  requireHumanApproval: boolean;
  enabled: boolean;
}

export interface PlaybookCondition {
  type: "anomaly_severity" | "health_status" | "metric_threshold" | "compound";
  severityThreshold?: AnomalySeverity;
  healthStatusThreshold?: "ok" | "degraded" | "overloaded" | "unhealthy";
  metricName?: string;
  metricValue?: number;
  operator?: "gt" | "lt" | "gte" | "lte" | "eq";
  compoundOperator?: "and" | "or";
  subConditions?: PlaybookCondition[];
}

export interface StopLossEvent {
  id: string;
  playbookId: string;
  playbookName: string;
  triggerReason: string;
  actionsExecuted: StopLossAction[];
  escalationLevel: EscalationLevel;
  executedAt: string;
  completedAt: string | null;
  success: boolean;
  errorMessage?: string;
  autoTriggered: boolean;
  humanApproved: boolean;
}

export interface PendingApprovalExecution {
  playbook: StopLossPlaybook;
  triggerReason: string;
  context?: Record<string, unknown>;
}

export interface AutoStopLossConfig {
  enabled: boolean;
  defaultCooldownMs: number;
  maxEventsPerHour: number;
  enableAutoExecution: boolean;
  enableHumanEscalation: boolean;
  healthCheckIntervalMs: number;
}

export interface SystemHealthSnapshot {
  status: "ok" | "degraded" | "overloaded" | "unhealthy";
  anomalySeverity: AnomalySeverity | null;
  activeExecutions: number;
  queuedTasks: number;
  memoryUsageMb: number;
  eventLoopLagMs: number;
  providerHealth: "healthy" | "degraded" | "failed";
}

export interface ConditionMatchContext {
  severity?: AnomalySeverity;
  metricName?: string;
  healthStatus?: SystemHealthSnapshot["status"];
  context?: Record<string, unknown>;
}

export interface ActionContext {
  playbookId?: string;
  reason?: string;
  provider?: string;
  metricName?: string;
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  message: string;
  requiresApproval?: boolean;
}

export type ActionHandler = (context: ActionContext) => Promise<ActionResult>;

export const DEFAULT_PLAYBOOKS: StopLossPlaybook[] = [
  {
    id: "playbook_circuit_break_provider",
    name: "Circuit Break Unhealthy Provider",
    description: "Open circuit breaker when provider failure is detected",
    triggerCondition: {
      type: "anomaly_severity",
      severityThreshold: "critical",
    },
    actions: ["circuit_break", "isolate_provider"],
    cooldownMs: 60000,
    maxExecutionsPerHour: 10,
    requireHumanApproval: false,
    enabled: true,
  },
  {
    id: "playbook_critical_anomaly_escalate",
    name: "Critical Anomaly Human Escalation",
    description: "Escalate to human when emergency anomaly detected",
    triggerCondition: {
      type: "anomaly_severity",
      severityThreshold: "emergency",
    },
    actions: ["escalate_to_human"],
    cooldownMs: 300000,
    maxExecutionsPerHour: 5,
    requireHumanApproval: false,
    enabled: true,
  },
  {
    id: "playbook_overloaded_pause_non_critical",
    name: "Pause Non-Critical Under Overload",
    description: "Pause non-critical tasks when system is overloaded",
    triggerCondition: {
      type: "health_status",
      healthStatusThreshold: "overloaded",
    },
    actions: ["pause_non_critical", "reject_low_priority"],
    cooldownMs: 120000,
    maxExecutionsPerHour: 20,
    requireHumanApproval: false,
    enabled: true,
  },
  {
    id: "playbook_memory_pressure_scale_down",
    name: "Scale Down Under Memory Pressure",
    description: "Reduce execution capacity under memory pressure",
    triggerCondition: {
      type: "metric_threshold",
      metricName: "memory_usage_mb",
      metricValue: 1024,
      operator: "gt",
    },
    actions: ["scale_down", "force_garbage_collection"],
    cooldownMs: 180000,
    maxExecutionsPerHour: 10,
    requireHumanApproval: true,
    enabled: true,
  },
  {
    id: "playbook_unhealthy_disable_new_tasks",
    name: "Disable New Tasks When Unhealthy",
    description: "Stop accepting new tasks when system is unhealthy",
    triggerCondition: {
      type: "health_status",
      healthStatusThreshold: "unhealthy",
    },
    actions: ["disable_new_tasks", "pause_non_critical"],
    cooldownMs: 300000,
    maxExecutionsPerHour: 3,
    requireHumanApproval: true,
    enabled: true,
  },
];

export const SEVERITY_TO_ESCALATION: Record<AnomalySeverity, EscalationLevel> = {
  info: "observe",
  warning: "warn",
  critical: "act",
  emergency: "critical",
};

export const HEALTH_TO_ESCALATION: Record<string, EscalationLevel> = {
  ok: "observe",
  degraded: "warn",
  overloaded: "act",
  unhealthy: "critical",
};
