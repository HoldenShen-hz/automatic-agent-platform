/**
 * Model Routing CLI
 *
 * This module provides a command-line interface for routing LLM requests to
 * appropriate model providers based on capabilities, health status, and governance
 * policies. It supports capability matching, risk-based routing, and fallback
 * lease handling for model selection.
 *
 * Environment Variables:
 *   - AA_CONFIG_ROOT: Path to configuration root (defaults to ./config)
 *   - AA_MODEL_ROUTE_CLASS: Route class (e.g., fast, balanced, capable)
 *   - AA_MODEL_ROUTE_RISK_LEVEL: Risk level for routing (low, medium, high)
 *   - AA_MODEL_ROUTE_PREFERRED_PROFILE: Preferred model profile name
 *   - AA_MODEL_ROUTE_PINNED_PROFILE: Pinned model profile name
 *   - AA_MODEL_ROUTE_STICKY_PROFILE: Sticky model profile for session continuity
 *   - AA_MODEL_ROUTE_TURN_ID: Turn identifier for tracking
 *   - AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: JSON-encoded fallback lease configuration
 *   - AA_MODEL_ROUTE_MAX_INPUT_PER_1K_USD: Max input tokens per $1000 budget
 *   - AA_MODEL_ROUTE_REQUIRED_CAPABILITIES: Comma-separated required capabilities
 *   - AA_MODEL_ROUTE_ALLOW_STRONG_UPgrade: Allow upgrading to stronger models
 *   - AA_MODEL_HEALTH_JSON: JSON object mapping provider IDs to health summaries
 *   - AA_MODEL_ROUTE_GOVERNANCE_SNAPSHOT_JSON: Inline governance snapshot JSON
 *   - AA_MODEL_ROUTE_LOAD_GOVERNANCE_SNAPSHOT: Whether to load snapshot from DB
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for model routing architecture
 * @see {@link docs_zh/contracts/model_routing_contract.md} for routing contracts
 */

import { join } from "node:path";

import { withCliStorage } from "./authoritative-storage.js";
import { loadModelRoutingCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { loadModelMetadataRegistry } from "../../platform/control-plane/config-center/model-metadata-registry.js";
import {
  LlmEvalService,
} from "../../platform/prompt-engine/eval/llm-eval-service.js";
import {
  PromptModelPolicyGovernanceService,
} from "../../platform/prompt-engine/eval/prompt-model-policy-governance-service.js";
import type { ModelGovernanceSnapshot } from "../../platform/contracts/types/governance.js";
import {
  ModelRoutingService,
} from "../../platform/model-gateway/provider-registry/model-routing-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

/**
 * Loads the governance snapshot from storage or inline JSON environment variable.
 *
 * The governance snapshot contains model routing policies and constraints
 * used for routing decisions. Can be provided inline or loaded from database.
 *
 * @returns The governance snapshot, or null if not loaded
 */
function loadGovernanceSnapshot(
  envConfig: ReturnType<typeof loadModelRoutingCliEnv>,
): ModelGovernanceSnapshot | null {
  if (envConfig.governanceSnapshot != null) {
    return envConfig.governanceSnapshot;
  }

  if (!envConfig.loadGovernanceSnapshot) {
    return null;
  }

  return withCliStorage((storage) => {
    const db = storage.sql;
    const evalService = new LlmEvalService(db);
    const governance = new PromptModelPolicyGovernanceService(db, evalService);
    return governance.buildModelGovernanceSnapshot();
  }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});
}

const envConfig = loadModelRoutingCliEnv();
const configRoot = envConfig.configRoot ?? join(process.cwd(), "config");
const registry = loadModelMetadataRegistry(configRoot, createWorkspaceWritePolicy(configRoot));
const governanceSnapshot = loadGovernanceSnapshot(envConfig);
const service = new ModelRoutingService({
  registry,
  providerHealth: envConfig.providerHealth,
});

// Execute model routing with all configured parameters
const result = service.route({
  ...(envConfig.routeClass != null ? { routeClass: envConfig.routeClass } : {}),
  ...(envConfig.riskLevel != null ? { riskLevel: envConfig.riskLevel } : {}),
  ...(envConfig.requiredCapabilities != null && envConfig.requiredCapabilities.length > 0
    ? { requiredCapabilities: envConfig.requiredCapabilities }
    : {}),
  ...(envConfig.preferredProfileName != null ? { preferredProfileName: envConfig.preferredProfileName } : {}),
  ...(envConfig.pinnedProfileName != null ? { pinnedProfileName: envConfig.pinnedProfileName } : {}),
  ...(envConfig.stickyProfileName != null ? { stickyProfileName: envConfig.stickyProfileName } : {}),
  ...(envConfig.turnId != null ? { turnId: envConfig.turnId } : {}),
  ...(envConfig.fallbackLease != null ? { fallbackLease: envConfig.fallbackLease } : {}),
  ...(governanceSnapshot != null ? { governanceSnapshot } : {}),
  ...(envConfig.maxInputPer1kUsd != null ? { maxInputPer1kUsd: envConfig.maxInputPer1kUsd } : {}),
  ...(envConfig.allowStrongUpgrade ? { allowStrongUpgrade: envConfig.allowStrongUpgrade } : {}),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
