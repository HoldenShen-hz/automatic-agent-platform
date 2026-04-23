/**
 * Code Diagnostics Service
 *
 * Provides code diagnostics for TypeScript and Python source files by running
 * language-specific validation tools and collecting their results.
 *
 * Features:
 * - TypeScript diagnostics via the TypeScript compiler API (tsc)
 * - Python syntax validation via py_compile
 * - Canonicalizes paths and validates workspace boundaries
 * - Deduplicates diagnostics to prevent redundant reports
 * - Provides human-readable summary feedback
 *
 * This service is used after edit operations to verify code correctness
 * and provide feedback about potential issues in modified files.
 */
/**
 * Programming languages supported for diagnostics.
 */
export type CodeDiagnosticLanguage = "typescript" | "python";
/**
 * Severity level of a diagnostic message.
 */
export type CodeDiagnosticSeverity = "error" | "warning";
/**
 * A single diagnostic message from a code analysis tool.
 */
export interface CodeDiagnosticEntry {
    /** Language the diagnostic applies to */
    language: CodeDiagnosticLanguage;
    /** Severity level */
    severity: CodeDiagnosticSeverity;
    /** Path to the file with the diagnostic */
    filePath: string;
    /** Diagnostic message text */
    message: string;
    /** Error/warning code from the tool (e.g., TSXXXX) */
    code: string | null;
    /** Source of the diagnostic (e.g., "typescript", "tsconfig", "py_compile") */
    source: string;
    /** Line number where the issue occurs (1-indexed), null if unknown */
    line: number | null;
    /** Column number where the issue occurs (1-indexed), null if unknown */
    column: number | null;
}
/**
 * Summary of diagnostics across multiple files and languages.
 */
export interface CodeDiagnosticsSummary {
    /** Number of files that were checked */
    checkedFileCount: number;
    /** Number of files that had at least one diagnostic */
    diagnosticFileCount: number;
    /** Total number of error-level diagnostics */
    errorCount: number;
    /** Total number of warning-level diagnostics */
    warningCount: number;
    /** Languages found in the diagnostics */
    languages: readonly CodeDiagnosticLanguage[];
    /** Individual diagnostic entries */
    diagnostics: readonly CodeDiagnosticEntry[];
    /** Warnings from the diagnostics runner itself (e.g., tool unavailable) */
    runnerWarnings: readonly string[];
}
/**
 * Request to run diagnostics on specific files.
 */
export interface CodeDiagnosticsRunRequest {
    /** Root directory of the workspace */
    workspaceRoot: string;
    /** Files to run diagnostics on */
    filePaths: readonly string[];
    /** Maximum number of diagnostics to return */
    maxDiagnostics: number;
}
/**
 * Configuration options for CodeDiagnosticsService.
 */
export interface CodeDiagnosticsServiceOptions {
    /** Root directory to use (defaults to process.cwd()) */
    workspaceRoot?: string;
    /** Maximum diagnostics to return (default: 20) */
    maxDiagnostics?: number;
    /** Custom TypeScript diagnostics function (for testing) */
    runTypeScript?: (request: CodeDiagnosticsRunRequest) => readonly CodeDiagnosticEntry[];
    /** Custom Python diagnostics function (for testing) */
    runPython?: (request: CodeDiagnosticsRunRequest) => Promise<readonly CodeDiagnosticEntry[]>;
}
/**
 * Formats diagnostics summary into a human-readable feedback string.
 *
 * Returns null if there are no diagnostics to report.
 * Returns a string like:
 *   "Diagnostics: 2 errors, 1 warning across 2 file(s). First issue: src/app.ts:5:10 Cannot find name 'foo'."
 */
export declare function formatDiagnosticsFeedback(summary: CodeDiagnosticsSummary | null): string | null;
/**
 * CodeDiagnosticsService runs static analysis on source files to detect
 * errors and warnings in code.
 *
 * The service:
 * 1. Filters files by extension to determine language
 * 2. Validates files are within the workspace root
 * 3. Runs language-appropriate diagnostics (TypeScript via tsc, Python via py_compile)
 * 4. Deduplicates and limits results
 * 5. Collects summary statistics
 *
 * This is typically called after edit operations to verify code correctness
 * and provide feedback to the user about any issues.
 */
export declare class CodeDiagnosticsService {
    private readonly workspaceRoot;
    private readonly maxDiagnostics;
    private readonly runTypeScript;
    private readonly runPython;
    /**
     * Creates a new CodeDiagnosticsService.
     *
     * @param options - Configuration options
     */
    constructor(options?: CodeDiagnosticsServiceOptions);
    /**
     * Collects diagnostics for the specified files.
     *
     * @param filePaths - Files to analyze
     * @returns Summary of diagnostics, or null if no files could be analyzed
     */
    collectForFiles(filePaths: readonly string[]): Promise<CodeDiagnosticsSummary | null>;
}
