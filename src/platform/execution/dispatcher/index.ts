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
import { createWorkspaceWritePolicy } from "../../control-plane/iam/sandbox-policy.js";

import type { LlmModelCallResult } from "../execution-engine/model-call-provider.js";
import { executeAgentRoundLoop } from "../execution-engine/multi-step-agent-round-loop.js";
import { getMultiStepToolDefinitions } from "../execution-engine/multi-step-tool-definitions.js";
import { parseOptionalStringArray, resolveMultiStepToolPath, safeParseToolResult } from "../execution-engine/multi-step-utils.js";

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
  private spawnDepth: number = 0;

  constructor() {
    this.todoService = new TodoWriteToolService();
    this.webFetchTool = createWebFetchTool();
    this.webSearchTool = createWebSearchTool();
    this.commandExecutor = new CommandExecutor();
    this.repoRoot = process.cwd();
    this.spawnedAgents = new Map();
  }

  private getSpawnedAgent(agentId: string): SpawnedAgentState | null {
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
