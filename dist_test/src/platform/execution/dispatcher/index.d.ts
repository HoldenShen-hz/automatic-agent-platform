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
export interface MultiStepToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
/**
 * Tool registry for multi-step orchestration.
 * Maintains stateful tool services across tool call iterations within a single workflow run.
 */
declare class MultiStepToolRegistry {
    private readonly todoService;
    private readonly webFetchTool;
    private readonly webSearchTool;
    private readonly commandExecutor;
    private readonly repoRoot;
    private readonly spawnedAgents;
    private spawnDepth;
    constructor();
    private getSpawnedAgent;
    private buildDelegatedToolDefinitions;
    private buildSpawnedAgentRequest;
    private executeSpawnedAgent;
    private formatSpawnedAgentResponse;
    /**
     * Executes a tool by name with the given JSON arguments.
     * Returns a JSON string result for tool call result injection into LLM history.
     */
    executeToolCall(toolName: string, argumentsJson: string): Promise<string>;
}
/**
 * Gets or creates the singleton multi-step tool registry.
 */
export declare function getToolRegistry(): MultiStepToolRegistry;
/**
 * Resets the tool registry singleton (for test cleanup).
 */
export declare function resetToolRegistry(): void;
/**
 * Executes a tool call using the multi-step tool registry.
 * Delegates to the real tool implementations (TodoWriteToolService, WebFetchTool).
 */
export declare function executeToolCall(toolName: string, argumentsJson: string): Promise<string>;
/**
 * Test-only export: execute a tool call directly.
 */
export declare function executeMultiStepToolCallForTests(toolName: string, argumentsJson: string): Promise<string>;
/**
 * Test-only export: reset the tool registry singleton.
 */
export declare function resetMultiStepToolRegistryForTests(): void;
export {};
