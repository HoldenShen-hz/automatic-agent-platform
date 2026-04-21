import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { predictOpsCapacityRisk } from "./capacity-predictor/index.js";
import { buildConfigOptimizationSuggestion } from "./config-optimizer/index.js";
import { summarizeDeveloperAssistSuggestion } from "./dev-assistant/index.js";
import { summarizeOpsHealth, type OpsHealthProbe } from "./health-monitor/index.js";
import { classifyOpsIncident } from "./incident-diagnoser/index.js";

export type OpsActionType = "scale_capacity" | "tune_config" | "investigate_incident" | "developer_assist";
export type OpsMaturityLevel = "observe_only" | "suggest_only" | "supervised_execution" | "trusted_automation";
export type OpsRiskLevel = "low" | "medium" | "high";