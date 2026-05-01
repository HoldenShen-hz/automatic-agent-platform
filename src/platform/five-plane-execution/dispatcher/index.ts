/**
 * @fileoverview Multi-Step Tool Dispatcher - Tool execution for orchestration.
 *
 * Manages tool registry, tool call dispatch, and spawned agent lifecycle.
 * Part of the multi-step orchestration split:
 * - orchestrator/  - main coordination
 * - dispatcher/     - tool execution (this module)
 * - planner/       - DAG planning and step output building
 * - supervisor/     - execution monitoring
 */

import { resolve, sep } from "node:path";

import { ToolExecutionError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { TodoWriteToolService, executeTodoOperation, type TodoWriteToolRequest } from "../tool-executor/todo-write-tool.js";
import { createWebFetchTool } from "../tool-executor/web-fetch.js";
import { createWebSearchTool } from "../tool-executor/web-search.js";
import { CommandExecutor } from "../tool-executor/command-executor.js";
import { SemanticRepoMapService } from "../tool-executor/semantic-repo-map-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { BudgetGuard, type BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
import { PolicyEngine, mapToolRiskToPolicyCategory } from "../../five-plane-control-plane/iam/policy-engine.js";
import { checkSandboxPath, createWorkspaceWritePolicy, type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import { ToolRiskLevel } from "../tool-executor/tool-metadata.js";

import type { LlmModelCallResult } from "../execution-engine/model-call-provider.js";
import { executeAgentRoundLoop } from "../execution-engine/multi-step-agent-round-loop.js";
import { getMultiStepToolDefinitions } from "../execution-engine/multi-step-tool-definitions.js";
import { parseOptionalStringArray, resolveMultiStepToolPath, safeParseToolResult } from "../execution-engine/multi-step-utils.js";
import { createSideEffectRecord, type SideEffectKind, type SideEffectStatus } from "../../contracts/executable-contracts/index.js";
import { createEvidenceRecord, createPlatformPrincipal } from "../../contracts/types/platform-contracts.js";
import type { RuntimeTruthRepository } from "../../five-plane-state-evidence/truth/runtime-truth-repository.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MultiStepToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  result: string;
  success: boolean;
}

interface SpawnedAgentExecutionState {
  status: "running" | "succeeded" | "failed";
  summary: string | null;
  result: string | null;
  finishReason: "stop" | "max_iterations" | "error" | null;
  iterations: number;
  toolCalls: Array<{ toolName: string; success: boolean }>;
  updatedAt: string;
}

interface SpawnedAgentState {
  agentId: string;
  stepId: string;
  roleId: string;
  routingReason: string;
  delegatedToolNames: string[];
  maxIterations?: number;
  requestHistory: string[];
  execution: SpawnedAgentExecutionState | null;
}

// ---------------------------------------------------------------------------
// Tool Registry (singleton)
// ---------------------------------------------------------------------------

/** Module-level singleton registry instance */
let _toolRegistry: MultiStepToolRegistry | null = null;

/**
 * Tool registry for multi-step orchestration.
 * Maintains stateful tool services across tool call iterations within a single workflow run.
 */
class MultiStepToolRegistry {
  private readonly todoService: TodoWriteToolService;
  private readonly webFetchTool: ReturnType<typeof createWebFetchTool>;
  private readonly webSearchTool: ReturnType<typeof createWebSearchTool>;
  private readonly commandExecutor: CommandExecutor;
  private readonly repoRoot: string;
  private readonly spawnedAgents: Map<string, SpawnedAgentState>;
  private readonly budgetGuard: BudgetGuard;
  private readonly policyEngine: PolicyEngine;
  private readonly sandboxPolicy: SandboxPolicy;
  // R4-33 (INV-SIDEEFFECT-001): Track SideEffectRecords for external calls (web_fetch/web_search/git/repo-map)
  private readonly sideEffectRecords: Map<string, ReturnType<typeof createSideEffectRecord>>;
  // R4-35 (INV-EVIDENCE-001): Track EvidenceRecords for decisions and executions
  private readonly evidenceRecords: Map<string, ReturnType<typeof createEvidenceRecord>>;
  // R4-33/R4-35: RuntimeTruthRepository for persisting side effect and evidence records
  private runtimeTruthRepository: RuntimeTruthRepository | null = null;
  private spawnDepth: number = 0;
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_SPAWNED_AGENTS = 500;
  private readonly AGENT_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_SPAWN_DEPTH = 10; // Issue #1907 P1: Limit spawn depth to prevent unbounded recursion
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  constructor() {
    this.todoService = new TodoWriteToolService();
    this.webFetchTool = createWebFetchTool();
    this.webSearchTool = createWebSearchTool();
    this.commandExecutor = new CommandExecutor();
    this.repoRoot = process.cwd();
    this.spawnedAgents = new Map();
    this.sideEffectRecords = new Map();
    this.evidenceRecords = new Map();
    this.budgetGuard = new BudgetGuard();
    this.sandboxPolicy = createWorkspaceWritePolicy(this.repoRoot);
    // R4-34 (INV-POLICY-001): Initialize PolicyEngine with default budget policy
    this.policyEngine = new PolicyEngine({
      budgetPolicy: this.getDefaultBudgetPolicy(),
    });
  }

  /**
   * R4-33/R4-35: Set the RuntimeTruthRepository for persisting side effect and evidence records.
   * This must be called before tool execution to enable proper record persistence.
   */
  public setRuntimeTruthRepository(repository: RuntimeTruthRepository): void {
    this.runtimeTruthRepository = repository;
  }

  /**
   * R4-33/R4-35: Get the currently set RuntimeTruthRepository.
   */
  public getRuntimeTruthRepository(): RuntimeTruthRepository | null {
    return this.runtimeTruthRepository;
  }

  private getDefaultBudgetPolicy(): BudgetPolicy {
    return {
      maxTaskCostUsd: 10,
      maxDailyCostUsd: 100,
      maxMonthlyCostUsd: 1000,
      warnAtRatio: 0.8,
      mode: "auto",
    };
  }

  private estimateToolCost(toolName: string): number {
    // Estimate tool execution cost based on tool type
    const toolCosts: Record<string, number> = {
      web_search: 0.005,
      web_fetch: 0.003,
      git: 0.001,
      repo_map: 0.002,
      todo_write: 0.0001,
      spawn_agent: 0.01,
      batch_tool: 0.005,
    };
    return toolCosts[toolName] ?? 0.001;
  }

  private assertBudgetAllowed(toolName: string): void {
    // R4-25 (INV-BUDGET-001): Reserve budget before tool call using BudgetAllocator.reserve()
    const estimatedCost = this.estimateToolCost(toolName);
    // R4-25: First evaluate if task can proceed
    const evaluation = this.budgetGuard.evaluateTaskSpend({
      policy: this.getDefaultBudgetPolicy(),
      currentTaskCostUsd: 0,
      nextEstimatedCostUsd: estimatedCost,
    });
    if (!evaluation.allowed) {
      throw new ToolExecutionError(
        "tool.budget_exceeded",
        `Budget limit exceeded for tool execution: ${toolName} - ${evaluation.reasonCode}`,
        { toolName, retryable: false },
      );
    }
    // R4-25: Actually reserve the budget using reserveExecutionChainBudget
    const reservationResult = this.budgetGuard.reserveExecutionChainBudget({
      policy: this.getDefaultBudgetPolicy(),
      spend: {
        currentTaskCostUsd: 0,
        nextEstimatedCostUsd: estimatedCost,
        currentPackCostUsd: 0,
        currentPlatformCostUsd: 0,
        currentDailyCostUsd: 0,
        currentMonthlyCostUsd: 0,
      },
      tenantId: "tenant:local",
      harnessRunId: "harness_run:multi_step_dispatcher",
      traceId: newId("trace"),
      emittedBy: "MultiStepToolRegistry",
    });
    if (!reservationResult.allowed || !reservationResult.reservation) {
      throw new ToolExecutionError(
        "tool.budget_reservation_failed",
        `Budget reservation failed for tool: ${toolName} - ${reservationResult.reservationReasonCode ?? evaluation.reasonCode}`,
        { toolName, retryable: false },
      );
    }
  }

  private getToolRiskLevel(toolName: string): ToolRiskLevel {
    // Map tool names to risk levels
    const riskLevels: Record<string, ToolRiskLevel> = {
      web_fetch: "medium",
      web_search: "medium",
      git: "high",
      spawn_agent: "high",
      batch_tool: "medium",
      todo_write: "low",
      repo_map: "low",
      question: "low",
    };
    return riskLevels[toolName] ?? "medium";
  }

  private assertPolicyAllowed(toolName: string, args: Record<string, unknown>): void {
    // R4-34 (INV-POLICY-001): Deny-by-default - PolicyEngine check before tool dispatch
    const riskLevel = this.getToolRiskLevel(toolName);
    const riskCategory = mapToolRiskToPolicyCategory(riskLevel);

    const decision = this.policyEngine.evaluate({
      decisionId: `tool_policy_${Date.now()}`,
      taskId: "multi-step-orchestration",
      subjectType: "agent",
      subjectId: "multi-step-agent",
      action: "invoke_tool",
      riskCategory,
      mode: "auto",
      estimatedCostUsd: this.estimateToolCost(toolName),
      metadata: {
        toolName,
        args: JSON.stringify(args).slice(0, 200),
      },
    });

    if (decision.decision === "deny") {
      throw new ToolExecutionError(
        "tool.policy_denied",
        `Tool ${toolName} denied by policy engine: ${decision.reasonCode}`,
        { toolName, retryable: false },
      );
    }

    if (decision.decision === "escalate_for_approval") {
      throw new ToolExecutionError(
        "tool.approval_required",
        `Tool ${toolName} requires approval: ${decision.reasonCode}`,
        { toolName, retryable: false },
      );
    }
  }

  private assertSandboxAllowed(toolName: string, args: Record<string, unknown>): void {
    // R4-31 (INV-SANDBOX): Enforce sandbox policy before tool execution
    // R4-31: The hardcoded empty policy for todo_write was incorrect.
    // Deny-by-default: any tool not explicitly allowed should be blocked.

    // For todo_write, enforce proper sandbox policy
    if (toolName === "todo_write") {
      const request = args as TodoWriteToolRequest;
      const allowOperations = Array.isArray((this.sandboxPolicy as { allow?: unknown }).allow)
        ? ((this.sandboxPolicy as { allow: unknown[] }).allow.filter((value): value is string => typeof value === "string"))
        : [];
      const denyOperations = Array.isArray((this.sandboxPolicy as { deny?: unknown }).deny)
        ? ((this.sandboxPolicy as { deny: unknown[] }).deny.filter((value): value is string => typeof value === "string"))
        : [];
      // R4-31: Write operations on todo_write need explicit sandbox allow
      // Read-only operations (list, get) are allowed by default
      const writeOperations = ["create", "update", "delete"];
      if (writeOperations.includes(request.operation)) {
        // The hardcoded {allow:[],deny:[]} policy should deny by default
        // Empty policy means deny by default (deny-by-default invariant)
        if (allowOperations.length === 0 && denyOperations.length === 0) {
          logger.log({
            level: "debug",
            message: "R4-31 (INV-SANDBOX): Empty sandbox policy, denying write operation by default",
            data: { operation: request.operation, toolName },
          });
          throw new ToolExecutionError(
            "tool.sandbox_policy_denied",
            `Sandbox policy denies tool ${toolName} with operation ${request.operation}: empty policy defaults to deny`,
            { toolName, retryable: false },
          );
        }
        // Check if operation is explicitly allowed
        const isAllowed = allowOperations.includes(request.operation) && !denyOperations.includes(request.operation);
        if (!isAllowed) {
          throw new ToolExecutionError(
            "tool.sandbox_violation",
            `Tool ${toolName} with operation ${request.operation} denied by sandbox policy`,
            { toolName, retryable: false },
          );
        }
      }
      return; // Only todo_write was checked - other tools continue below
    }

    // Only check tools that interact with the filesystem
    const sandboxedTools = ["git", "repo-map", "spawn-agent"];
    if (!sandboxedTools.includes(toolName)) {
      return;
    }

    // For git operations, check paths are within sandbox
    if (toolName === "git" && args.args) {
      const cwd = typeof args.cwd === "string" ? args.cwd : this.repoRoot;
      const pathCheck = checkSandboxPath(this.sandboxPolicy, cwd);
      if (!pathCheck.allowed) {
        throw new ToolExecutionError(
          "tool.sandbox_violation",
          `Git operation outside sandbox: ${pathCheck.reasonCode}`,
          { toolName, retryable: false },
        );
      }
    }

    // For repo-map, check root path is within sandbox
    if (toolName === "repo-map" && args.rootPath) {
      const rootPath = typeof args.rootPath === "string" ? args.rootPath : this.repoRoot;
      const pathCheck = checkSandboxPath(this.sandboxPolicy, rootPath);
      if (!pathCheck.allowed) {
        throw new ToolExecutionError(
          "tool.sandbox_violation",
          `Repo-map operation outside sandbox: ${pathCheck.reasonCode}`,
          { toolName, retryable: false },
        );
      }
    }
  }

  private createSideEffectRecordForExternalCall(
    toolName: string,
    args: Record<string, unknown>,
    harnessRunId: string = "harness_run:dispatcher",
  ): { sideEffectRecord: ReturnType<typeof createSideEffectRecord> | null; effectKind: SideEffectKind } {
    // R4-33 (INV-SIDEEFFECT-001): Create SideEffectRecord for external calls
    // web_fetch and web_search produce real side effects but don't record/track/reconcile
    const effectKind: SideEffectKind = ["web_fetch", "web_search"].includes(toolName)
      ? "external_api"
      : toolName === "git" || toolName === "repo-map"
        ? "file_write"
        : "other";

    // Only create SideEffectRecord for production-relevant side effects
    if (!["web_fetch", "web_search", "git", "repo-map"].includes(toolName)) {
      return { sideEffectRecord: null, effectKind };
    }

    const sideEffectRecord = createSideEffectRecord({
      harnessRunId,
      nodeRunId: "pending:node_run",
      nodeAttemptId: "pending:attempt",
      effectKind,
      idempotencyKey: `tool_call:${toolName}:${Date.now()}`,
      riskClass: toolName === "git" || toolName === "spawn_agent" ? "high" : "medium",
      preCommitPolicyProofRef: { artifactId: "pending:policy_proof", uri: "pending://", hash: "pending" },
      externalRef: toolName === "web_fetch" ? (args.url as string) : toolName === "web_search" ? (args.query as string) : null,
      deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // R4-33: Store SideEffectRecord in memory Map for quick lookup during execution
    this.sideEffectRecords.set(sideEffectRecord.sideEffectId, sideEffectRecord);

    // R4-33 (INV-SIDEEFFECT-001): Persist SideEffectRecord to RuntimeTruthRepository
    // This ensures side effects are tracked and can be reconciled
    if (this.runtimeTruthRepository != null) {
      try {
        this.runtimeTruthRepository.seed("SideEffectRecord", sideEffectRecord);
        logger.log({
          level: "debug",
          message: "R4-33 (INV-SIDEEFFECT-001): Persisted SideEffectRecord to RuntimeTruthRepository",
          data: { sideEffectId: sideEffectRecord.sideEffectId, harnessRunId },
        });
      } catch (error) {
        // If seed fails (e.g., duplicate), log but don't fail the tool execution
        logger.log({
          level: "warn",
          message: "R4-33 (INV-SIDEEFFECT-001): Failed to persist SideEffectRecord, will use in-memory only",
          data: { sideEffectId: sideEffectRecord.sideEffectId, error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    logger.log({
      level: "debug",
      message: "R4-33 (INV-SIDEEFFECT-001): Created SideEffectRecord for external call",
      data: {
        sideEffectId: sideEffectRecord.sideEffectId,
        toolName,
        effectKind,
        status: sideEffectRecord.status,
        externalRef: sideEffectRecord.externalRef,
      },
    });
    return { sideEffectRecord, effectKind };
  }

  /**
   * C-11: Evict expired spawned agents to prevent memory leaks.
   */
  private evictExpiredAgents(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.AGENT_TTL_MS;
    const entriesToDelete: string[] = [];

    for (const [agentId, state] of this.spawnedAgents) {
      if (state.execution?.updatedAt) {
        const updatedAt = new Date(state.execution.updatedAt).getTime();
        if (updatedAt < expiryThreshold) {
          entriesToDelete.push(agentId);
        }
      }
    }

    for (const agentId of entriesToDelete) {
      this.spawnedAgents.delete(agentId);
    }

    // If still over capacity, remove oldest agents
    if (this.spawnedAgents.size > this.MAX_SPAWNED_AGENTS) {
      const sortedEntries = [...this.spawnedAgents.entries()].sort((a, b) => {
        const aTime = a[1].execution?.updatedAt ? new Date(a[1].execution!.updatedAt).getTime() : 0;
        const bTime = b[1].execution?.updatedAt ? new Date(b[1].execution!.updatedAt).getTime() : 0;
        return aTime - bTime;
      });

      const toRemove = this.spawnedAgents.size - this.MAX_SPAWNED_AGENTS;
      for (let i = 0; i < toRemove; i++) {
        this.spawnedAgents.delete(sortedEntries[i]![0]);
      }
    }
  }

  private getSpawnedAgent(agentId: string): SpawnedAgentState | null {
    // C-11: Evict expired agents before getting
    this.evictExpiredAgents();
    return this.spawnedAgents.get(agentId) ?? null;
  }

  private buildDelegatedToolDefinitions(toolNames: readonly string[]): MultiStepToolDefinition[] | undefined {
    if (toolNames.length === 0) {
      return undefined;
    }
    const resolved = getMultiStepToolDefinitions(toolNames);
    return resolved.length > 0 ? resolved : undefined;
  }

  private buildSpawnedAgentRequest(state: SpawnedAgentState): string {
    const [initialRequest = "", ...followUps] = state.requestHistory;
    if (followUps.length === 0) {
      return initialRequest;
    }
    return `${initialRequest}\n\nFollow-up messages:\n${followUps.map((message, index) => `${index + 1}. ${message}`).join("\n")}`;
  }

  private async executeSpawnedAgent(state: SpawnedAgentState): Promise<SpawnedAgentExecutionState> {
    const previousExecution = state.execution;
    const delegatedTools = this.buildDelegatedToolDefinitions(state.delegatedToolNames);
    state.execution = {
      status: "running",
      summary: null,
      result: null,
      finishReason: null,
      iterations: 0,
      toolCalls: [],
      updatedAt: nowIso(),
    };

    this.spawnDepth += 1;
    // Issue #1907 P1: Enforce spawn depth limit to prevent stack overflow and unbounded recursion
    if (this.spawnDepth > this.MAX_SPAWN_DEPTH) {
      this.spawnDepth -= 1;
      throw new ToolExecutionError(
        "tool.spawn_depth_exceeded",
        `Spawned agent depth ${this.spawnDepth} exceeds maximum ${this.MAX_SPAWN_DEPTH}. Possible unbounded recursion.`,
        { toolName: "spawn-agent", retryable: false },
      );
    }
    try {
      const delegated = await executeAgentRoundLoop({
        stepId: state.stepId,
        roleId: state.roleId,
        request: this.buildSpawnedAgentRequest(state),
        priorSummaries: previousExecution?.summary != null ? [previousExecution.summary] : [],
        routingReason: state.routingReason,
        ...(delegatedTools != null ? { tools: delegatedTools } : {}),
        ...(state.maxIterations != null ? { maxIterations: state.maxIterations } : {}),
      });

      const execution: SpawnedAgentExecutionState = {
        status: delegated.finishReason === "error" ? "failed" : "succeeded",
        summary: delegated.summary,
        result: delegated.result,
        finishReason: delegated.finishReason,
        iterations: delegated.iterations,
        toolCalls: delegated.toolCalls.map((toolCall) => ({
          toolName: toolCall.toolName,
          success: toolCall.success,
        })),
        updatedAt: nowIso(),
      };
      state.execution = execution;
      return execution;
    } finally {
      this.spawnDepth -= 1;
    }
  }

  private formatSpawnedAgentResponse(agentId: string, state: SpawnedAgentState): string {
    const execution = state.execution;
    const success = execution?.status !== "failed";
    return JSON.stringify({
      success,
      status: execution?.status ?? "running",
      agentId,
      messageCount: state.requestHistory.length,
      summary: execution?.summary ?? null,
      result: execution?.result ?? null,
      finishReason: execution?.finishReason ?? null,
      iterations: execution?.iterations ?? 0,
      toolCalls: execution?.toolCalls ?? [],
      updatedAt: execution?.updatedAt ?? nowIso(),
    });
  }

  /**
   * Executes a tool by name with the given JSON arguments.
   * Returns a JSON string result for tool call result injection into LLM history.
   */
  async executeToolCall(toolName: string, argumentsJson: string): Promise<string> {
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argumentsJson);
    } catch (err) {
      logger.log({
        level: "debug",
        message: "Failed to parse tool arguments as JSON, using raw value",
        data: { error: err instanceof Error ? err.message : String(err), rawArgs: argumentsJson },
      });
      args = { raw: argumentsJson };
    }

    // R4-25 (INV-BUDGET-001): Enforce budget check before tool execution
    this.assertBudgetAllowed(toolName);

    // R4-34 (INV-POLICY-001): Deny-by-default - PolicyEngine check before tool dispatch
    this.assertPolicyAllowed(toolName, args);

    // R4-31 (INV-SANDBOX): Enforce sandbox policy before tool execution
    this.assertSandboxAllowed(toolName, args);

    // R4-33 (INV-SIDEEFFECT-001): Create SideEffectRecord for external calls
    // web_fetch/web_search produce real side effects but don't record/track/reconcile
    const sideEffect = this.createSideEffectRecordForExternalCall(toolName, args);

    // R4-35 (INV-EVIDENCE-001): Create EvidenceRecord for all tool executions
    // This provides immutable evidence of every decision and execution
    const principal = createPlatformPrincipal({ actorId: "multi-step-dispatcher", tenantId: "tenant:local" });
    const evidenceRecord = createEvidenceRecord({
      traceId: newId("trace"),
      principal,
      category: "execution",
      targetRef: `tool:${toolName}`,
      content: {
        toolName,
        args: Object.keys(args).length > 0 ? Object.fromEntries(Object.keys(args).map((k) => [k, typeof args[k] === "string" ? args[k] : "[object]"])) : {},
        effectKind: sideEffect.effectKind,
        sideEffectId: sideEffect.sideEffectRecord?.sideEffectId ?? null,
        timestamp: nowIso(),
      },
      metadata: { source: "dispatcher", version: "1.0" },
    });
    this.evidenceRecords.set(evidenceRecord.recordId, evidenceRecord);

    switch (toolName) {
      case "todo_write": {
        const request = {
          callId: `call_${Date.now()}`,
          taskId: "",
          agentId: "multi-step",
          traceId: "",
          toolName: "todo_write",
          sandboxPolicy: { allow: [], deny: [] },
          operation: (args.operation as "create" | "update" | "delete" | "list" | "get") ?? "create",
          sessionId: args.sessionId as string | null ?? null,
          todoId: args.todoId as string | null ?? null,
          title: args.title as string | null ?? null,
          description: args.description as string | null ?? null,
          status: args.status as "pending" | "in_progress" | "completed" | "cancelled" | null ?? null,
          priority: args.priority as number | null ?? null,
          parentTodoId: args.parentTodoId as string | null ?? null,
          progressPercent: args.progressPercent as number | null ?? null,
          filterStatus: args.filterStatus as "pending" | "in_progress" | "completed" | "cancelled" | null ?? null,
          filterSessionId: args.filterSessionId as string | null ?? null,
        } as unknown as TodoWriteToolRequest;
        const result = executeTodoOperation(this.todoService, request);
        return JSON.stringify(result);
      }

      case "question": {
        const result = {
          success: true,
          status: "skipped" as const,
          answer: null,
          durationMs: 0,
          error: null,
          errorCode: null,
        };
        return JSON.stringify(result);
      }

      case "web_search": {
        const query = args.query as string;
        if (!query) {
          return JSON.stringify({ success: false, results: [], count: 0, error: "query is required", errorCode: "MISSING_QUERY" });
        }
        const searchResult = await this.webSearchTool.execute({
          query,
          limit: (args.limit as number) ?? 10,
          timeoutMs: (args.timeoutMs as number) ?? 15000,
          ...(args.language != null ? { language: args.language as string } : {}),
        });
        return JSON.stringify(searchResult);
      }

      case "web_fetch": {
        const url = args.url as string;
        if (!url) {
          return JSON.stringify({ success: false, status: "failed", error: "url is required", errorCode: "MISSING_URL", durationMs: 0 });
        }
        const fetchResult = await this.webFetchTool.execute({ url });
        return JSON.stringify(fetchResult);
      }

      case "git": {
        const rawArgs = parseOptionalStringArray(args.args);
        if (rawArgs.length === 0) {
          return JSON.stringify({ success: false, status: "failed", error: "git args are required", errorCode: "MISSING_GIT_ARGS", durationMs: 0 });
        }
        try {
          const cwd = resolveMultiStepToolPath(this.repoRoot, typeof args.cwd === "string" ? args.cwd : this.repoRoot);
          const timeoutMs = (typeof args.timeoutMs === "number" && args.timeoutMs > 0) ? Math.trunc(args.timeoutMs) : undefined;
          const result = await this.commandExecutor.execute({
            callId: newId("call"),
            taskId: "multi-step",
            agentId: "multi-step",
            traceId: "multi-step",
            toolName: "command_exec",
            command: "git",
            args: rawArgs,
            cwd,
            sandboxPolicy: createWorkspaceWritePolicy(cwd),
            allowedPathRoots: [cwd],
            ...(timeoutMs != null ? { timeoutMs } : {}),
          });
          return JSON.stringify({ requestedToolName: "git", ...result });
        } catch (error) {
          return JSON.stringify({ success: false, status: "failed", error: error instanceof Error ? error.message : String(error), errorCode: "GIT_EXECUTION_FAILED", durationMs: 0 });
        }
      }

      case "repo-map": {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        if (query.length === 0) {
          return JSON.stringify({ success: false, status: "failed", error: "query is required", errorCode: "MISSING_QUERY", durationMs: 0 });
        }
        try {
          const rootPath = resolveMultiStepToolPath(this.repoRoot, typeof args.rootPath === "string" ? args.rootPath : this.repoRoot);
          const limit = (typeof args.limit === "number" && args.limit > 0) ? Math.trunc(args.limit) : undefined;
          const repoMap = new SemanticRepoMapService(rootPath);
          const searchResult = repoMap.search({
            query,
            ...(typeof args.currentFile === "string" ? { currentFile: args.currentFile } : {}),
            ...(limit != null ? { limit } : {}),
          });
          return JSON.stringify({
            success: true,
            status: "succeeded",
            rootPath,
            files: searchResult.files.map((file) => ({ relativePath: file.relativePath, imports: file.imports, referencedBy: file.referencedBy, depth: file.depth })),
            symbols: searchResult.symbols.map((symbol) => ({ name: symbol.name, kind: symbol.kind, filePath: symbol.filePath, line: symbol.line, column: symbol.column })),
            fileCount: searchResult.files.length,
            symbolCount: searchResult.symbols.length,
          });
        } catch (error) {
          return JSON.stringify({ success: false, status: "failed", error: error instanceof Error ? error.message : String(error), errorCode: "REPO_MAP_ERROR", durationMs: 0 });
        }
      }

      case "spawn-agent": {
        const agentId = typeof args.agentId === "string" ? args.agentId : `agent_${Date.now()}`;
        const existing = this.getSpawnedAgent(agentId);
        if (existing != null) {
          return this.formatSpawnedAgentResponse(agentId, existing);
        }
        const state: SpawnedAgentState = {
          agentId,
          stepId: (args.stepId as string | undefined) ?? "spawn",
          roleId: (args.roleId as string | undefined) ?? "agent",
          routingReason: (args.routingReason as string | undefined) ?? "",
          delegatedToolNames: parseOptionalStringArray(args.tools),
          requestHistory: [(args.request as string | undefined) ?? ""],
          execution: null,
          ...((typeof args.maxIterations === "number" && args.maxIterations > 0) ? { maxIterations: Math.trunc(args.maxIterations) } : {}),
        };
        this.spawnedAgents.set(agentId, state);
        const execResult = await this.executeSpawnedAgent(state);
        return this.formatSpawnedAgentResponse(agentId, state);
      }

      case "wait-agent": {
        const agentId = args.agentId as string;
        if (!agentId) {
          return JSON.stringify({ success: false, error: "agentId is required", errorCode: "MISSING_AGENT_ID", durationMs: 0 });
        }
        const agentState = this.getSpawnedAgent(agentId);
        if (!agentState) {
          return JSON.stringify({ success: false, error: `Agent ${agentId} not found`, errorCode: "AGENT_NOT_FOUND", durationMs: 0 });
        }
        return this.formatSpawnedAgentResponse(agentId, agentState);
      }

      case "send-message": {
        const agentId = args.agentId as string;
        const message = args.message as string;
        if (!agentId || !message) {
          return JSON.stringify({ success: false, error: "agentId and message are required", errorCode: "MISSING_ARGS", durationMs: 0 });
        }
        const agentState = this.getSpawnedAgent(agentId);
        if (!agentState) {
          return JSON.stringify({ success: false, error: `Agent ${agentId} not found`, errorCode: "AGENT_NOT_FOUND", durationMs: 0 });
        }
        agentState.requestHistory.push(message);
        const execResult = await this.executeSpawnedAgent(agentState);
        return this.formatSpawnedAgentResponse(agentId, agentState);
      }

      case "batch-tool": {
        const toolCalls = args.toolCalls as Array<{ toolName: string; arguments: Record<string, unknown> }> | undefined;
        const parallel = args.parallel as boolean | undefined;
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
          return JSON.stringify({ success: false, results: [], error: "toolCalls array is required", errorCode: "MISSING_TOOL_CALLS" });
        }
        const results: Array<{ toolName: string; result: string; success: boolean }> = [];
        if (parallel) {
          const batchResults = await Promise.all(
            toolCalls.map(async (tc) => {
              const result = await this.executeToolCall(tc.toolName, JSON.stringify(tc.arguments ?? {}));
              const parsed = safeParseToolResult(result);
              return { toolName: tc.toolName, result: JSON.stringify(parsed), success: true };
            }),
          );
          results.push(...batchResults);
        } else {
          for (const tc of toolCalls) {
            const result = await this.executeToolCall(tc.toolName, JSON.stringify(tc.arguments ?? {}));
            const parsed = safeParseToolResult(result);
            results.push({ toolName: tc.toolName, result: JSON.stringify(parsed), success: true });
          }
        }
        return JSON.stringify({ success: true, executionMode: parallel ? "parallel" : "serial", results });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}`, errorCode: "UNKNOWN_TOOL", durationMs: 0 });
    }
  }
}

/**
 * Gets or creates the singleton multi-step tool registry.
 */
export function getToolRegistry(): MultiStepToolRegistry {
  if (_toolRegistry === null) {
    _toolRegistry = new MultiStepToolRegistry();
  }
  return _toolRegistry;
}

/**
 * Resets the tool registry singleton (for test cleanup).
 */
export function resetToolRegistry(): void {
  _toolRegistry = null;
}

/**
 * Executes a tool call using the multi-step tool registry.
 * Delegates to the real tool implementations (TodoWriteToolService, WebFetchTool).
 */
export async function executeToolCall(toolName: string, argumentsJson: string): Promise<string> {
  return getToolRegistry().executeToolCall(toolName, argumentsJson);
}

/**
 * Test-only export: execute a tool call directly.
 */
export async function executeMultiStepToolCallForTests(toolName: string, argumentsJson: string): Promise<string> {
  return executeToolCall(toolName, argumentsJson);
}

/**
 * Test-only export: reset the tool registry singleton.
 */
export function resetMultiStepToolRegistryForTests(): void {
  _toolRegistry = null;
}
