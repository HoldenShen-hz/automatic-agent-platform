/**
 * Tool Output Sanitizer
 *
 * This module provides sanitization for tool output before it is returned to agents
 * or stored for audit purposes. It handles:
 * - ANSI escape sequence removal (color codes, cursor movement, etc.)
 * - Control character removal (null bytes, Bell, Backspace, etc.)
 * - Secret redaction (API keys, tokens, credentials)
 * - Injection attack detection (prompt injection, system prompt override attempts)
 * - Output truncation for large outputs
 * - Line ending normalization
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/sandbox_contract.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/governance/glossary_and_terminology.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */
export type PromptInjectionRuleId = "instruction_override" | "system_prompt_exfiltration" | "developer_message_exfiltration" | "credential_exfiltration" | "remote_shell_pivot";
/**
 * Classification levels for injection risk detected in tool output.
 */
export type InjectionRisk = "none" | "low" | "medium" | "high";
/**
 * Sanitized output result containing cleaned text and diagnostic metadata.
 */
export interface SanitizedToolOutput {
    /** Reference to raw output storage if persisted; null if not persisted */
    rawRef: string | null;
    /** Sanitized text with secrets redacted and control characters removed */
    sanitizedText: string;
    /** Whether the output was truncated due to size limits */
    truncated: boolean;
    /** Number of secret instances redacted from the output */
    redactionCount: number;
    /** Number of control characters removed from the output */
    controlCharsRemoved: number;
    /** Whether any ANSI escape sequences were present and removed */
    ansiRemoved: boolean;
    /** Whether NFC normalization was applied */
    nfcNormalized: boolean;
    /** Number of Unicode Tags block characters removed */
    unicodeTagsRemoved: number;
    /** Number of zero-width characters removed */
    zeroWidthCharsRemoved: number;
    /** Number of private use area characters removed */
    privateUseCharsRemoved: number;
    /** Assessed risk level for prompt injection attacks */
    injectionRisk: InjectionRisk;
    /** Matched rule ids used to assess prompt injection risk */
    matchedInjectionRules: PromptInjectionRuleId[];
    /** List of warning codes for any transformations applied */
    warnings: string[];
}
/**
 * Configuration options for output sanitization.
 */
export interface SanitizeOutputOptions {
    /** Reference identifier for raw output storage (optional) */
    rawRef?: string;
    /** Maximum characters to retain in persisted message; defaults to 4000 */
    persistedMessageLimitChars?: number;
}
export interface SanitizedStructuredOutput<T> {
    sanitizedValue: T;
    redactionCount: number;
    controlCharsRemoved: number;
    ansiRemoved: boolean;
    nfcNormalized: boolean;
    unicodeTagsRemoved: number;
    zeroWidthCharsRemoved: number;
    privateUseCharsRemoved: number;
    injectionRisk: InjectionRisk;
    matchedInjectionRules: PromptInjectionRuleId[];
    warnings: string[];
}
/**
 * Sanitizes tool output by removing sensitive content, control characters,
 * and ANSI sequences while detecting injection attacks.
 *
 * Processing steps (in order):
 * 1. Remove ANSI escape sequences (color codes, cursor movement, etc.)
 * 2. Remove control characters (except newlines and tabs)
 * 3. Redact secrets matching known patterns (API keys, tokens)
 * 4. Normalize line endings (CRLF -> LF) and trim trailing whitespace
 * 5. Truncate if exceeding persistedMessageLimitChars (60% head, 30% tail)
 * 6. Assess injection risk based on suspicious patterns
 * 7. Generate warnings for any transformations applied
 *
 * @param rawOutput - The raw output string from tool execution
 * @param options - Sanitization configuration options
 * @returns SanitizedToolOutput with cleaned text and diagnostic metadata
 */
export declare function sanitizeToolOutput(rawOutput: string, options?: SanitizeOutputOptions): SanitizedToolOutput;
export declare function sanitizeStructuredOutput<T>(rawValue: T): SanitizedStructuredOutput<T>;
