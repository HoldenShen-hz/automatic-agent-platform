/**
 * Trusted Context Scanner
 *
 * Scans workspace files for potential prompt injection attacks and
 * other security concerns in "trusted context" files like AGENTS.md,
 * division configurations, and instruction files.
 *
 * ## Purpose
 *
 * Agent systems often load instructions from workspace files that are
 * trusted to execute without additional sandboxing. This scanner detects
 * when those files may have been compromised or contain:
 *
 * - Prompt injection phrases ("ignore previous instructions")
 * - Hidden Unicode characters (bidi override attacks)
 * - Control characters that could manipulate output
 * - Encoded instructions that evade simple text scanning
 *
 * ## What Gets Scanned
 *
 * By default, the scanner examines:
 * - AGENTS.md / AGENT.md / CLAUDE.md (root agent files)
 * - All division.yaml, .prompt.md, and .instructions.md files
 *
 * ## Trust Levels
 *
 * - **trusted**: No issues found
 * - **warning**: Suspicious patterns detected, review recommended
 * - **untrusted**: Critical issues found, file should not be trusted
 *
 * @see docs_zh/contracts/security_contract.md
 */
import { type SandboxPolicy } from "./sandbox-policy.js";
/**
 * Severity level for scanner findings.
 * - critical: Immediate trust compromise (prompt injection, hidden unicode)
 * - warning: Suspicious patterns that may need review
 */
export type TrustedContextFindingSeverity = "warning" | "critical";
/**
 * Overall trust assessment for a file or workspace.
 */
export type TrustedContextTrustLevel = "trusted" | "warning" | "untrusted";
/**
 * A security finding from scanning trusted context content.
 */
export interface TrustedContextFinding {
    /** Error code identifying the type of finding */
    code: "context_trust.prompt_injection_phrase" | "context_trust.hidden_unicode" | "context_trust.control_character" | "context_trust.encoded_instruction" | "context_trust.sandbox_denied";
    severity: TrustedContextFindingSeverity;
    message: string;
    line: number;
    column: number;
    snippet: string;
}
/**
 * Report for a single scanned file.
 */
export interface TrustedContextFileReport {
    /** Path to the file that was scanned */
    filePath: string;
    /** Overall trust level for this file */
    trustLevel: TrustedContextTrustLevel;
    /** All findings in this file */
    findings: TrustedContextFinding[];
}
/**
 * Complete report for a workspace scan.
 */
export interface TrustedContextWorkspaceReport {
    /** Root of the workspace that was scanned */
    workspaceRoot: string;
    /** When the scan was performed */
    generatedAt: string;
    /** Reports for each file that was scanned */
    scannedFiles: TrustedContextFileReport[];
    /** Aggregated findings across all files */
    findings: TrustedContextFinding[];
    /** Overall trust level for the workspace */
    trustLevel: TrustedContextTrustLevel;
}
/**
 * Configuration options for the trusted context scanner.
 */
export interface TrustedContextScannerOptions {
    /** Sandbox policy for path validation */
    sandboxPolicy?: SandboxPolicy;
    /** Whether to scan root agent files (AGENTS.md, etc.) */
    includeRootAgentFiles?: boolean;
    /** Whether to scan division files */
    includeDivisionFiles?: boolean;
}
/**
 * Scans file content for trusted context security issues.
 * This is the core scanning function that analyzes text content.
 *
 * @param filePath - Path for reporting purposes
 * @param content - The file content to scan
 * @returns Report with findings and trust level
 */
export declare function scanTrustedContextContent(filePath: string, content: string): TrustedContextFileReport;
/**
 * Scans the entire workspace for trusted context security issues.
 * This is the main entry point for workspace-wide scanning.
 *
 * Collects and scans:
 * 1. Root agent files (AGENTS.md, AGENT.md, CLAUDE.md) if enabled
 * 2. Division files (division.yaml, .prompt.md, .instructions.md) if enabled
 *
 * @param workspaceRoot - Root directory of the workspace to scan
 * @param options - Scanner configuration options
 * @returns Complete scan report for the workspace
 */
export declare function scanTrustedContextWorkspace(workspaceRoot: string, options?: TrustedContextScannerOptions): TrustedContextWorkspaceReport;
