/**
 * Command Security Assessment
 *
 * ## Overview
 *
 * Provides security assessment for system commands before execution.
 * Implements multi-layer security model for the tool execution system.
 *
 * ## Key Concepts
 *
 * - **Sandbox**: Execution isolation boundary
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: sandbox}
 *
 * - **Exec Policy**: Ruleset for tool/command execution
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: exec policy}
 *
 * - **Permission**: Authorization state for subject to use capability
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: permission}
 *
 * ## Security Checks
 *
 * 1. Shell metacharacter detection - blocks |, >, <, `, &&, ||, ;, $(...)
 * 2. Inline code execution - blocks interpreters with -c/-e flags
 * 3. Remote script download - blocks curl|wget piping to shell
 * 4. Destructive command flagging - allows but marks as high risk
 *
 * @see Security Contract: docs_zh/contracts/security_contract.md
 * @see Sandbox Contract: docs_zh/contracts/sandbox_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
export interface CommandPolicyDefinition {
    allowed: boolean;
    riskLevel: "low" | "medium" | "high" | "critical";
    reasonCode?: string;
    /**
     * Argument positions that are file paths to validate against sandbox policy.
     * - Positive indices (0, 1, 2...) are 0-indexed from the start of args.
     * - Negative indices (-1, -2...) count from the end (-1 = last arg, -2 = second-to-last).
     * Empty array means no args should be sandbox-path-validated.
     */
    pathArgPositions?: readonly number[];
}
export declare function createDefaultCommandPolicies(): Map<string, CommandPolicyDefinition>;
/**
 * Result of a command security assessment.
 * Contains the decision (allowed/blocked), reason code if blocked,
 * and assessed risk level.
 */
export interface CommandAssessment {
    /** Whether the command is allowed to execute */
    allowed: boolean;
    /** Machine-readable reason code if command is blocked; null if allowed */
    reasonCode: string | null;
    /** Assessed risk level regardless of allow/block decision */
    riskLevel: "low" | "medium" | "high" | "critical";
    /** Command arguments that should be treated as sandboxed read paths */
    sandboxReadArgPaths: readonly string[];
}
export declare class CommandSafetyClassifier {
    private readonly options;
    private readonly cache;
    private readonly maxCacheEntries;
    constructor(options?: {
        ttlMs?: number;
        now?: () => number;
        policies?: ReadonlyMap<string, CommandPolicyDefinition>;
        maxCacheEntries?: number;
    });
    assess(command: string, args: readonly string[]): CommandAssessment;
    /**
     * Extracts file path arguments based on the policy's pathArgPositions specification.
     * Supports both positive (from start) and negative (from end) indices.
     */
    private extractPolicyPathArgs;
    /**
     * S-05: Detects curl/wget downloading scripts piped to shell across separate arguments.
     * Original regex only matched within a single argument string.
     */
    private containsRemoteScriptPipe;
    private getBaseAssessment;
}
/**
 * Assesses a command for security risks before execution.
 *
 * @param command - The base command executable name
 * @param args - The command-line arguments
 * @returns CommandAssessment with allow/block decision and risk level
 */
export declare function assessCommand(command: string, args: readonly string[]): CommandAssessment;
