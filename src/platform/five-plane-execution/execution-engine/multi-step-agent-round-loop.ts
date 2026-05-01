/**
 * @fileoverview Agent round loop and step output builder for multi-step orchestration.
 */

import type { LlmModelCallResult } from "./model-call-provider.js";
import { initializeModelCallProvider } from "./model-call-provider.js";
import type { MultiStepToolDefinition } from "./multi-step-tool-definitions.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { BudgetLedger } from "../../contracts/executable-contracts/index.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export interface AgentRoundLoopInput {
  stepId: string;
  roleId: string;
  request: string;
  priorSummaries: string[];
  routingReason: string;
  tools?: MultiStepToolDefinition[];
  maxIterations?: number;
  // R4-25 (INV-BUDGET-001): Budget tracking from validated PlanGraphBundle
  harnessRunId: string;
  budgetLedger: BudgetLedger;
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

export async function executeAgentRoundLoop(input: AgentRoundLoopInput): Promise<AgentRoundLoopResult> {
  // R4-25 (INV-BUDGET-001): Pass budgetLedger and harnessRunId to model provider
  // so BudgetAllocator.reserve() uses the shared ledger from validatedPlanGraphBundle
  const modelProvider = initializeModelCallProvider({
    budgetLedger: input.budgetLedger,
    harnessRunId: input.harnessRunId,
  });
  const maxIterations = input.maxIterations ?? 10;

  if (!modelProvider.hasAnyProvider()) {
    return fallbackStepOutput(input);
  }

  const priorContext = input.priorSummaries.length > 0
    ? `Prior step outputs:\n${input.priorSummaries.map((summary, index) => `${index + 1}. ${summary}`).join("\n")}`
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
    const item: {
      type: "function";
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    } = {
      type: "function",
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

      if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
        for (const toolCall of llmResult.toolCalls) {
          messages.push({
            role: "assistant",
            content: "",
          });

          const { executeToolCall } = await import("../dispatcher/index.js");
          const toolResult = await executeToolCall(toolCall.function.name, toolCall.function.arguments);

          toolCallHistory.push({
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            result: toolResult,
            success: true,
          });

          messages.push({
            role: "user",
            content: `<tool_result id="${toolCall.id}">${toolResult}</tool_result>`,
          });
        }
        continue;
      }

      const content = llmResult.content || "";
      const { summary, result } = parseStepOutput(content, input.stepId);
      return { summary, result, llmResult, toolCalls: toolCallHistory, iterations, finishReason: "stop" };
    }

    const content = lastLlmResult?.content ?? "";
    const { summary, result } = parseStepOutput(content, input.stepId);
    return {
      summary,
      result,
      llmResult: lastLlmResult,
      toolCalls: toolCallHistory,
      iterations,
      finishReason: "max_iterations",
    };
  } catch (error) {
    logger.log({
      level: "error",
      message: "Agent round loop error",
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    const content = lastLlmResult?.content ?? "";
    const { summary, result } = parseStepOutput(content, input.stepId);
    return { summary, result, llmResult: lastLlmResult, toolCalls: toolCallHistory, iterations, finishReason: "error" };
  }
}

export function parseStepOutput(content: string, stepId: string): { summary: string; result: string } {
  if (content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content) as { summary?: string; result?: string };
      return { summary: parsed.summary || `Step ${stepId} completed`, result: parsed.result || content };
    } catch {
      logger.log({
        level: "debug",
        message: "Failed to parse step output as JSON, falling back to line parsing",
        data: { content: content.substring(0, 100) },
      });
    }
  }
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length >= 2 && lines[0]) {
    return {
      summary: lines[0].replace(/^[*-]\s*/, "").trim(),
      result: lines.slice(1).join("\n").trim(),
    };
  }
  return { summary: `Step ${stepId} completed`, result: content || `Step executed: ${stepId}` };
}

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

export interface BuildStepOutputInput {
  stepId: string;
  roleId: string;
  request: string;
  priorSummaries: string[];
  routingReason: string;
  tools?: MultiStepToolDefinition[];
  // R4-25 (INV-BUDGET-001): Budget tracking from validated PlanGraphBundle
  harnessRunId: string;
  budgetLedger: BudgetLedger;
}

export interface BuildStepOutputResult {
  summary: string;
  result: string;
  llmResult?: LlmModelCallResult;
  toolCalls?: ToolCallResult[];
  iterations?: number;
}

export async function buildStepOutput(input: BuildStepOutputInput): Promise<BuildStepOutputResult> {
  const loopResult = await executeAgentRoundLoop({
    stepId: input.stepId,
    roleId: input.roleId,
    request: input.request,
    priorSummaries: input.priorSummaries,
    routingReason: input.routingReason,
    ...(input.tools !== undefined ? { tools: input.tools } : {}),
    harnessRunId: input.harnessRunId,
    budgetLedger: input.budgetLedger,
  });
  return {
    summary: loopResult.summary,
    result: loopResult.result,
    ...(loopResult.llmResult != null ? { llmResult: loopResult.llmResult } : {}),
    ...(loopResult.toolCalls.length > 0 ? { toolCalls: loopResult.toolCalls } : {}),
    ...(loopResult.iterations > 0 ? { iterations: loopResult.iterations } : {}),
  };
}
