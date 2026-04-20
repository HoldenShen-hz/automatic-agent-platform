/**
 * @fileoverview Multi-Step Planner - DAG planning and step output building.
 *
 * Contains:
 * - executeAgentRoundLoop: multi-round LLM call loop with tool execution
 * - buildStepOutput: builds step output from LLM interactions
 * - parseStepOutput: parses LLM output into structured step data
 * - Tool definition constants and helpers
 *
 * Part of the multi-step orchestration split:
 * - orchestrator/  - main coordination
 * - dispatcher/   - tool execution
 * - planner/      - DAG planning and step output building (this module)
 * - supervisor/   - execution monitoring
 */

import { resolve, sep } from "node:path";

import { ToolExecutionError } from "../../../platform/contracts/errors.js";
import { nowIso } from "../../../platform/contracts/types/ids.js";
import { initializeModelCallProvider, type LlmModelCallResult } from "../../../platform/execution/execution-engine/model-call-provider.js";
import { StructuredLogger } from "../../../platform/shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export interface MultiStepToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const MULTI_STEP_TOOL_DEFINITIONS: readonly MultiStepToolDefinition[] = [
  {
    name: "todo_write",
    description: "Create, update, delete, list, or fetch structured todos for the current task.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string" },
        sessionId: { type: "string" },
        todoId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        priority: { type: "number" },
        parentTodoId: { type: "string" },
        progressPercent: { type: "number" },
        filterStatus: { type: "string" },
        filterSessionId: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "question",
    description: "Ask a human clarification question when the task cannot safely proceed.",
    inputSchema: {
      type: "object",
      properties: { question: { type: "string" }, context: { type: "string" } },
      additionalProperties: true,
    },
  },
  {
    name: "web_search",
    description: "Search the public web for recent or relevant information.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" }, language: { type: "string" }, timeoutMs: { type: "number" } },
      required: ["query"],
      additionalProperties: true,
    },
  },
  {
    name: "web_fetch",
    description: "Fetch a web page by URL and return sanitized content.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
      additionalProperties: true,
    },
  },
  {
    name: "git",
    description: "Run a git command inside the current repository root with sandboxed path scoping.",
    inputSchema: {
      type: "object",
      properties: { args: { type: "array", items: { type: "string" } }, cwd: { type: "string" }, timeoutMs: { type: "number" } },
      required: ["args"],
      additionalProperties: false,
    },
  },
  {
    name: "repo-map",
    description: "Build a semantic repository map and search for relevant files or symbols.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, rootPath: { type: "string" }, currentFile: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "spawn-agent",
    description: "Delegate a bounded subtask to a local child agent loop and return its result.",
    inputSchema: {
      type: "object",
      properties: { request: { type: "string" }, roleId: { type: "string" }, stepId: { type: "string" }, routingReason: { type: "string" }, tools: { type: "array", items: { type: "string" } }, maxIterations: { type: "number" } },
      required: ["request"],
      additionalProperties: false,
    },
  },
  {
    name: "wait-agent",
    description: "Check the latest result for a previously spawned child agent.",
    inputSchema: {
      type: "object",
      properties: { agentId: { type: "string" }, timeoutMs: { type: "number" } },
      required: ["agentId"],
      additionalProperties: false,
    },
  },
  {
    name: "send-message",
    description: "Send a follow-up message to a spawned child agent and refresh its latest result.",
    inputSchema: {
      type: "object",
      properties: { agentId: { type: "string" }, message: { type: "string" } },
      required: ["agentId", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "batch-tool",
    description: "Execute multiple supported tool calls in one request, optionally in parallel for read-only tools.",
    inputSchema: {
      type: "object",
      properties: {
        parallel: { type: "boolean" },
        toolCalls: {
          type: "array",
          items: {
            type: "object",
            properties: { toolName: { type: "string" }, arguments: { type: "object" } },
            required: ["toolName"],
            additionalProperties: true,
          },
        },
      },
      required: ["toolCalls"],
      additionalProperties: false,
    },
  },
];

/**
 * Filters tool definitions by the given tool names.
 */
export function getMultiStepToolDefinitions(toolNames: readonly string[]): MultiStepToolDefinition[] {
  const allowed = new Set(toolNames);
  return MULTI_STEP_TOOL_DEFINITIONS.filter((tool) => allowed.has(tool.name));
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function parseOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.trunc(value);
}

export function parseOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function resolveMultiStepToolPath(rootPath: string, inputPath: string | null | undefined): string {
  const resolved = resolve(rootPath, inputPath ?? ".");
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${sep}`)) {
    throw new ToolExecutionError(
      `tool.path_outside_workspace:${inputPath ?? "."}`,
      `tool.path_outside_workspace:${inputPath ?? "."}`,
    );
  }
  return resolved;
}

export function safeParseToolResult(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Agent round loop types and implementation
// ---------------------------------------------------------------------------

export interface AgentRoundLoopInput {
  stepId: string;
  roleId: string;
  request: string;
  priorSummaries: string[];
  routingReason: string;
  tools?: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>;
  maxIterations?: number;
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  result: string;
  success: boolean;
}

export interface AgentRoundLoopResult {
  summary: string;
  result: string;
  llmResult: LlmModelCallResult | null;
  toolCalls: ToolCallResult[];
  iterations: number;
  finishReason: "stop" | "max_iterations" | "error";
}

/**
 * Executes a multi-round LLM call loop with tool execution support.
 *
 * This function implements the core agent loop:
 * 1. Build initial message history with system prompt and user context
 * 2. Make LLM call with available tools
 * 3. If LLM requests tool calls, execute them and inject results
 * 4. Continue until LLM produces text output or max iterations reached
 */
export async function executeAgentRoundLoop(input: AgentRoundLoopInput): Promise<AgentRoundLoopResult> {
  const modelProvider = initializeModelCallProvider({});
  const maxIterations = input.maxIterations ?? 10;

  if (!modelProvider.hasAnyProvider()) {
    return fallbackStepOutput(input);
  }

  const priorContext = input.priorSummaries.length > 0
    ? `Prior step outputs:\n${input.priorSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    : "No prior steps completed yet.";

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `You are a workflow execution assistant. Given a workflow step and context, produce a structured output.

For each step, provide:
- summary: A brief (1-2 sentence) description of what this step accomplished
- result: A detailed explanation of the step's outcome

Step types:
- intake_triage: Analyze the user's request and determine routing
- draft_solution: Create an initial solution based on the triage
- final_review: Review and finalize the output

You have access to tools. If you need to gather information or perform actions, use the available tools.
Always be concise and informative.`,
    },
    {
      role: "user",
      content: `Execute step: ${input.stepId}
Role: ${input.roleId}
Original request: ${input.request}
Routing reason: ${input.routingReason}

${priorContext}`,
    },
  ];

  const llmTools: Array<{
    type: "function";
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  }> | undefined = input.tools?.map((tool) => {
    const item: { type: "function"; name: string; description?: string; parameters: Record<string, unknown> } = {
      type: "function" as const,
      name: tool.name,
      parameters: tool.inputSchema,
    };
    if (tool.description !== undefined) {
      item.description = tool.description;
    }
    return item;
  });

  const toolCallHistory: ToolCallResult[] = [];
  let iterations = 0;
  let lastLlmResult: LlmModelCallResult | null = null;

  try {
    while (iterations < maxIterations) {
      iterations += 1;

      const llmResult = await modelProvider.createCompletion({
        model: modelProvider.getDefaultModel(),
        messages,
        maxTokens: 2048,
        temperature: 0.3,
        ...(llmTools != null ? { tools: llmTools } : {}),
      });

      lastLlmResult = llmResult;

      // Check if the LLM made tool calls
      if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
        for (const tc of llmResult.toolCalls) {
          messages.push({
            role: "assistant",
            content: "",
          });

          // Dynamically import to avoid circular dependency with dispatcher
          const { executeToolCall } = await import("../../../platform/execution/dispatcher/index.js");
          const toolResult = await executeToolCall(tc.function.name, tc.function.arguments);

          toolCallHistory.push({
            toolCallId: tc.id,
            toolName: tc.function.name,
            result: toolResult,
            success: true,
          });

          // Anthropic format for tool results
          messages.push({
            role: "user",
            content: `<tool_result id="${tc.id}">${toolResult}</tool_result>`,
          });
        }
        continue;
      }

      // No tool calls - LLM produced a final response
      const content = llmResult.content || "";
      const { summary, result } = parseStepOutput(content, input.stepId);
      return { summary, result, llmResult, toolCalls: toolCallHistory, iterations, finishReason: "stop" };
    }

    // Max iterations reached
    const content = lastLlmResult?.content ?? "";
    const { summary, result } = parseStepOutput(content, input.stepId);
    return { summary, result, llmResult: lastLlmResult, toolCalls: toolCallHistory, iterations, finishReason: "max_iterations" };
  } catch (error) {
    logger.log({ level: "error", message: "Agent round loop error", data: { error: error instanceof Error ? error.message : String(error) } });
    const content = lastLlmResult?.content ?? "";
    const { summary, result } = parseStepOutput(content, input.stepId);
    return { summary, result, llmResult: lastLlmResult, toolCalls: toolCallHistory, iterations, finishReason: "error" };
  }
}

/**
 * Parses the LLM output to extract summary and result.
 */
export function parseStepOutput(content: string, stepId: string): { summary: string; result: string } {
  if (content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      return { summary: parsed.summary || `Step ${stepId} completed`, result: parsed.result || content };
    } catch {
      logger.log({ level: "debug", message: "Failed to parse step output as JSON, falling back to line parsing", data: { content: content.substring(0, 100) } });
    }
  }
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length >= 2 && lines[0]) {
    return { summary: lines[0].replace(/^[*-]\s*/, "").trim(), result: lines.slice(1).join("\n").trim() };
  }
  return { summary: `Step ${stepId} completed`, result: content || `Step executed: ${stepId}` };
}

/**
 * Fallback implementation when no LLM provider is available.
 */
export function fallbackStepOutput(input: AgentRoundLoopInput): AgentRoundLoopResult {
  let summary: string;
  let result: string;
  switch (input.stepId) {
    case "intake_triage":
      summary = "Request triaged for single-division orchestration.";
      result = `Route reason=${input.routingReason}; request=${input.request}`;
      break;
    case "draft_solution":
      summary = "Draft solution prepared from triage context.";
      result = `Draft generated from prior steps: ${input.priorSummaries.join(" | ")}`;
      break;
    case "final_review":
      summary = "Final orchestration review completed.";
      result = `Final answer synthesized from workflow outputs: ${input.priorSummaries.join(" | ")}`;
      break;
    default:
      summary = `Step ${input.stepId} completed.`;
      result = `Role ${input.roleId} completed request: ${input.request}`;
  }
  return { summary, result, llmResult: null, toolCalls: [], iterations: 0, finishReason: "stop" };
}

// ---------------------------------------------------------------------------
// Step output builder
// ---------------------------------------------------------------------------

export interface BuildStepOutputInput {
  stepId: string;
  roleId: string;
  request: string;
  priorSummaries: string[];
  routingReason: string;
  tools?: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>;
}

export interface BuildStepOutputResult {
  summary: string;
  result: string;
  llmResult?: LlmModelCallResult;
  toolCalls?: ToolCallResult[];
  iterations?: number;
}

/**
 * Builds a step output based on the step ID and input parameters.
 * Uses real LLM calls with multi-round tool execution support.
 */
export async function buildStepOutput(input: BuildStepOutputInput): Promise<BuildStepOutputResult> {
  const loopResult = await executeAgentRoundLoop(input);
  return {
    summary: loopResult.summary,
    result: loopResult.result,
    ...(loopResult.llmResult != null ? { llmResult: loopResult.llmResult } : {}),
    ...(loopResult.toolCalls.length > 0 ? { toolCalls: loopResult.toolCalls } : {}),
    ...(loopResult.iterations > 0 ? { iterations: loopResult.iterations } : {}),
  };
}
