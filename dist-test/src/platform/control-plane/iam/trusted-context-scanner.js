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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkSandboxPath, createWorkspaceWritePolicy } from "./sandbox-policy.js";
/**
 * Patterns used to detect prompt injection attacks.
 * These are common phrases used to try to override system instructions.
 */
const PROMPT_INJECTION_PATTERNS = [
    {
        code: "context_trust.prompt_injection_phrase",
        severity: "critical",
        pattern: /\bignore\s+(all\s+)?previous\s+instructions\b/i,
        message: "Suspicious instruction override phrase detected.",
    },
    {
        code: "context_trust.prompt_injection_phrase",
        severity: "critical",
        pattern: /\byou\s+are\s+now\b/i,
        message: "Prompt role reassignment phrase detected.",
    },
    {
        code: "context_trust.prompt_injection_phrase",
        severity: "warning",
        pattern: /\b(system|developer)\s*:/i,
        message: "Prompt-like channel prefix detected in trusted context.",
    },
    {
        code: "context_trust.encoded_instruction",
        severity: "warning",
        pattern: /\b[A-Za-z0-9+/]{80,}={0,2}\b/,
        message: "Long encoded-looking token detected in trusted context.",
    },
];
/**
 * Hidden Unicode characters that can be used for attacks.
 * These include:
 * - Bidirectional override characters (can swap text visually)
 * - Zero-width characters (can hide text)
 * - Invisible formatting characters
 */
const HIDDEN_UNICODE_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;
/**
 * Control characters that should not appear in trusted text files.
 * These can cause unexpected behavior in terminals and parsers.
 */
const CONTROL_CHARACTER_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u;
/**
 * Returns current time as ISO string.
 */
function nowIso() {
    return new Date().toISOString();
}
/**
 * Computes the overall trust level from a list of findings.
 * Critical findings override everything - if any exist, trust is "untrusted".
 * Warning findings suggest review needed but don't fully compromise trust.
 * No findings means the content is trusted.
 *
 * @param findings - The findings to evaluate
 * @returns Overall trust level
 */
function computeTrustLevel(findings) {
    if (findings.some((finding) => finding.severity === "critical")) {
        return "untrusted";
    }
    if (findings.length > 0) {
        return "warning";
    }
    return "trusted";
}
/**
 * Extracts a snippet of text around a match position for context.
 * Provides characters before and after the match for human review.
 *
 * @param line - The line containing the match
 * @param column - 1-indexed column of the match
 * @returns Snippet with surrounding context
 */
function buildSnippet(line, column) {
    const start = Math.max(0, column - 20);
    const end = Math.min(line.length, column + 60);
    return line.slice(start, end);
}
/**
 * Scans a single line of text for security concerns.
 * Checks against all known attack patterns.
 *
 * @param line - The line to scan
 * @param lineNumber - 1-indexed line number for reporting
 * @returns Array of findings in this line
 */
function scanLine(line, lineNumber) {
    const findings = [];
    // Check prompt injection patterns
    for (const entry of PROMPT_INJECTION_PATTERNS) {
        const match = entry.pattern.exec(line);
        if (match == null || match.index < 0) {
            continue;
        }
        findings.push({
            code: entry.code,
            severity: entry.severity,
            message: entry.message,
            line: lineNumber,
            column: match.index + 1,
            snippet: buildSnippet(line, match.index),
        });
    }
    // Check for hidden Unicode characters (bidi, zero-width, etc.)
    const hiddenMatch = HIDDEN_UNICODE_PATTERN.exec(line);
    if (hiddenMatch?.index != null) {
        findings.push({
            code: "context_trust.hidden_unicode",
            severity: "critical",
            message: "Hidden or bidi Unicode control characters detected.",
            line: lineNumber,
            column: hiddenMatch.index + 1,
            snippet: buildSnippet(line, hiddenMatch.index),
        });
    }
    // Check for control characters
    const controlMatch = CONTROL_CHARACTER_PATTERN.exec(line);
    if (controlMatch?.index != null) {
        findings.push({
            code: "context_trust.control_character",
            severity: "critical",
            message: "Non-printable control character detected.",
            line: lineNumber,
            column: controlMatch.index + 1,
            snippet: buildSnippet(line, controlMatch.index),
        });
    }
    return findings;
}
/**
 * Scans file content for trusted context security issues.
 * This is the core scanning function that analyzes text content.
 *
 * @param filePath - Path for reporting purposes
 * @param content - The file content to scan
 * @returns Report with findings and trust level
 */
export function scanTrustedContextContent(filePath, content) {
    const findings = content
        .split(/\r?\n/u)
        .flatMap((line, index) => scanLine(line, index + 1));
    return {
        filePath,
        trustLevel: computeTrustLevel(findings),
        findings,
    };
}
/**
 * Recursively collects division-related files from a directory.
 * Division files include configuration and instruction documents.
 *
 * @param divisionsRoot - Root directory containing divisions
 * @returns Array of paths to division files
 */
function collectDivisionFiles(divisionsRoot) {
    if (!existsSync(divisionsRoot)) {
        return [];
    }
    const results = [];
    const queue = [divisionsRoot];
    while (queue.length > 0) {
        const current = queue.shift();
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const filePath = join(current, entry.name);
            if (entry.isDirectory()) {
                queue.push(filePath);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            // Division files have specific naming conventions
            if (entry.name === "division.yaml"
                || entry.name.endsWith(".prompt.md")
                || entry.name.endsWith(".instructions.md")) {
                results.push(filePath);
            }
        }
    }
    return results.sort((left, right) => left.localeCompare(right));
}
/**
 * Reads and scans a single trusted context file.
 * Handles sandbox path validation and error reporting.
 *
 * @param filePath - Path to the file to read and scan
 * @param policy - Sandbox policy for path validation
 * @returns Scan report for the file
 */
function readTrustedContextFile(filePath, policy) {
    const check = checkSandboxPath(policy, filePath);
    if (!check.allowed) {
        return {
            filePath,
            trustLevel: "untrusted",
            findings: [
                {
                    code: "context_trust.sandbox_denied",
                    severity: "critical",
                    message: check.reasonCode ?? "Trusted context file denied by sandbox policy.",
                    line: 1,
                    column: 1,
                    snippet: filePath,
                },
            ],
        };
    }
    const content = readFileSync(check.normalizedPath, "utf8");
    return scanTrustedContextContent(check.normalizedPath, content);
}
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
export function scanTrustedContextWorkspace(workspaceRoot, options = {}) {
    const sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(workspaceRoot);
    const filePaths = new Set();
    // Collect root agent files
    if (options.includeRootAgentFiles !== false) {
        for (const candidate of ["AGENTS.md", "AGENT.md", "CLAUDE.md"]) {
            const filePath = join(workspaceRoot, candidate);
            if (existsSync(filePath)) {
                filePaths.add(filePath);
            }
        }
    }
    // Collect division files
    if (options.includeDivisionFiles !== false) {
        for (const filePath of collectDivisionFiles(join(workspaceRoot, "divisions"))) {
            filePaths.add(filePath);
        }
    }
    const scannedFiles = Array.from(filePaths)
        .sort((left, right) => left.localeCompare(right))
        .map((filePath) => readTrustedContextFile(filePath, sandboxPolicy));
    const findings = scannedFiles.flatMap((entry) => entry.findings);
    return {
        workspaceRoot,
        generatedAt: nowIso(),
        scannedFiles,
        findings,
        trustLevel: computeTrustLevel(findings),
    };
}
//# sourceMappingURL=trusted-context-scanner.js.map