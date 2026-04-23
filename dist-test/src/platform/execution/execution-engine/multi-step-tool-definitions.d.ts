/**
 * @fileoverview Multi-Step Tool Definitions
 *
 * Tool definitions for multi-step orchestration.
 * These are static schemas used to define the tools available to LLM agents.
 */
export interface MultiStepToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export declare const MULTI_STEP_TOOL_DEFINITIONS: readonly MultiStepToolDefinition[];
export declare function getMultiStepToolDefinitions(toolNames: readonly string[]): MultiStepToolDefinition[];
