/**
 * Evolution CLI Tool
 *
 * This module provides a command-line interface for agent evolution operations
 * including budget policy proposals, experience promotion proposals, proposal
 * synchronization, application, rollback, listing, and budget policy resolution.
 *
 * Usage:
 *   npm run evolution propose_budget            # Propose budget adjustment
 *   npm run evolution propose_experience        # Propose experience promotion
 *   npm run evolution sync                      # Sync proposal approval status
 *   npm run evolution apply                      # Apply approved proposal
 *   npm run evolution rollback                   # Rollback applied proposal
 *   npm run evolution list                       # List proposal views
 *   npm run evolution resolve_budget              # Resolve budget policy
 *   npm run evolution evaluate_budget            # Evaluate task spend against policy
 *
 * Environment Variables:
 *   - AA_EVOLUTION_ACTION: The evolution operation to perform
 *   - AA_TASK_ID: Target task identifier
 *   - AA_EXECUTION_ID: Target execution identifier
 *   - AA_SOURCE_AGENT_ID: Source agent identifier
 *   - AA_SCOPE_TYPE: Scope type (agent, task, workflow, etc.)
 *   - AA_SCOPE_REF: Scope reference identifier
 *   - Additional action-specific variables documented in the CLI env loader
 *
 * @see {@link docs_zh/contracts/} - Evolution contracts
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Evolution terminology
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */

import { withCliStorage } from "./authoritative-storage.js";
import { loadEvolutionCliEnv } from "../../platform/control-plane/config-center/product-cli-env.js";
import { ApprovalService } from "../../platform/control-plane/approval-center/approval-service.js";
import { BudgetGuard } from "../../platform/model-gateway/cost-tracker/budget-guard.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { EvolutionMvpService } from "../../ops-maturity/drift-detection/evolution-mvp-service.js";
import { MemoryService } from "../../platform/state-evidence/memory/memory-service.js";

/**
 * Main entry point for the evolution CLI.
 *
 * Initializes the database, approval service, memory service, and evolution
 * service, then dispatches to the appropriate evolution operation based on
 * the AA_EVOLUTION_ACTION environment variable. Supports budget proposals,
 * experience promotions, proposal lifecycle management, and budget evaluation.
 * Outputs results as formatted JSON and ensures the database connection
 * is properly closed.
 */
function main(): void {
  const envConfig = loadEvolutionCliEnv();
  const result = withCliStorage((storage) => {
    const approvalService = new ApprovalService(storage.sql, storage.store);
    const memoryService = new MemoryService(storage.store);
    const evolution = new EvolutionMvpService(storage.sql, storage.store, approvalService, memoryService);

    switch (envConfig.action) {
    case "propose_budget":
      if (envConfig.taskId == null || envConfig.sourceAgentId == null || envConfig.scopeType == null || envConfig.scopeRef == null || envConfig.proposalReason == null) {
        throw new ValidationError("missing_env:evolution_propose_budget", "missing_env:evolution_propose_budget");
      }
      return evolution.proposeBudgetAdjustment({
        taskId: envConfig.taskId,
        executionId: envConfig.executionId,
        sourceAgentId: envConfig.sourceAgentId,
        scopeType: envConfig.scopeType,
        scopeRef: envConfig.scopeRef,
        currentPolicy: envConfig.currentPolicy,
        observedAverageCostUsd: envConfig.observedAverageCostUsd ?? 0,
        sampleSize: envConfig.sampleSize ?? 0,
        successRate: envConfig.successRate ?? 0,
        proposalReason: envConfig.proposalReason,
      });
    case "propose_experience":
      if (
        envConfig.taskId == null ||
        envConfig.sourceAgentId == null ||
        envConfig.scopeType == null ||
        envConfig.scopeRef == null ||
        envConfig.targetScope == null ||
        envConfig.taskContext == null ||
        envConfig.taskIntent == null
      ) {
        throw new ValidationError("missing_env:evolution_propose_experience", "missing_env:evolution_propose_experience");
      }
      return evolution.proposeExperiencePromotion({
        taskId: envConfig.taskId,
        executionId: envConfig.executionId,
        sourceAgentId: envConfig.sourceAgentId,
        scopeType: envConfig.scopeType,
        scopeRef: envConfig.scopeRef,
        targetScope: envConfig.targetScope,
        taskContext: envConfig.taskContext,
        taskIntent: envConfig.taskIntent,
        queryTools: envConfig.queryTools,
        ...(envConfig.minQualityScore !== null ? { minQualityScore: envConfig.minQualityScore } : {}),
      });
    case "sync":
      if (envConfig.proposalId == null) {
        throw new ValidationError("missing_env:AA_PROPOSAL_ID", "missing_env:AA_PROPOSAL_ID");
      }
      return evolution.syncProposalApprovalStatus(envConfig.proposalId);
    case "apply":
      if (envConfig.proposalId == null || envConfig.appliedBy == null) {
        throw new ValidationError("missing_env:evolution_apply", "missing_env:evolution_apply");
      }
      return evolution.applyProposal({
        proposalId: envConfig.proposalId,
        appliedBy: envConfig.appliedBy,
      });
    case "rollback":
      if (envConfig.proposalId == null || envConfig.rolledBackBy == null || envConfig.reasonCode == null) {
        throw new ValidationError("missing_env:evolution_rollback", "missing_env:evolution_rollback");
      }
      return evolution.rollbackProposal({
        proposalId: envConfig.proposalId,
        rolledBackBy: envConfig.rolledBackBy,
        reasonCode: envConfig.reasonCode,
      });
    case "list":
      return evolution.listProposalViews(envConfig.status as Parameters<typeof evolution.listProposalViews>[0] | undefined);
    case "resolve_budget":
      if (envConfig.scopeType == null || envConfig.scopeRef == null) {
        throw new ValidationError("missing_env:evolution_resolve_budget", "missing_env:evolution_resolve_budget");
      }
      return evolution.resolveBudgetPolicy(
        envConfig.basePolicy,
        envConfig.scopeType,
        envConfig.scopeRef,
      );
    case "evaluate_budget":
      if (envConfig.scopeType == null || envConfig.scopeRef == null) {
        throw new ValidationError("missing_env:evolution_evaluate_budget", "missing_env:evolution_evaluate_budget");
      }
      return new BudgetGuard().evaluateTaskSpend({
        policy: evolution.resolveBudgetPolicy(
          envConfig.basePolicy,
          envConfig.scopeType,
          envConfig.scopeRef,
        ).policy,
        currentTaskCostUsd: envConfig.currentTaskCostUsd ?? 0,
        nextEstimatedCostUsd: envConfig.nextEstimatedCostUsd ?? 0,
      });
    default:
      throw new ValidationError(`unknown_evolution_action:${envConfig.action}`, `unknown_evolution_action:${envConfig.action}`);
    }
  }, { dbPath: envConfig.dbPath });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
