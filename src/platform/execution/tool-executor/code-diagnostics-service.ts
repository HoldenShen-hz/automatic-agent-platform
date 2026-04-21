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

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";

import ts from "typescript";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const codeDiagnosticsLogger = new StructuredLogger({ retentionLimit: 100 });

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
 * TypeScript file extensions that are analyzed.
 */
const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

/**
 * Python file extensions that are analyzed.
 */
const PYTHON_EXTENSIONS = new Set([".py"]);

/**
 * Default maximum number of diagnostics to return.
 */
const DEFAULT_MAX_DIAGNOSTICS = 20;

/**
 * Canonicalizes a file path, resolving symlinks.
 * Used to ensure consistent path representation across the codebase.
 */
function canonicalizePath(filePath: string): string {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    return resolved;
  }
  try {
    return realpathSync(resolved);
  } catch (err) {
    codeDiagnosticsLogger.warn("code_diagnostics: realpathSync failed", { error: err instanceof Error ? err.message : String(err), filePath: resolved });
    return resolved;
  }
}

/**
 * Checks if a file path is within the workspace root.
 * Prevents diagnostics from running on files outside the allowed workspace.
 */
function isWithinWorkspace(workspaceRoot: string, filePath: string): boolean {
  const normalizedRoot = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`;
  return filePath === workspaceRoot || filePath.startsWith(normalizedRoot);
}

/**
 * Deduplicates diagnostic entries based on language, severity, file, code, line, column, and message.
 * This prevents returning the same diagnostic multiple times when it appears
 * in multiple forms or is reported by multiple analysis passes.
 */
function dedupeDiagnostics(diagnostics: readonly CodeDiagnosticEntry[], maxDiagnostics: number): CodeDiagnosticEntry[] {
  const seen = new Set<string>();
  const deduped: CodeDiagnosticEntry[] = [];

  for (const diagnostic of diagnostics) {
    // Create a unique key based on all identifying fields
    const key = [
      diagnostic.language,
      diagnostic.severity,
      diagnostic.filePath,
      diagnostic.code ?? "",
      diagnostic.line ?? "",
      diagnostic.column ?? "",
      diagnostic.message,
    ].join("::");
    if (seen.has(key)) {
      continue; // Skip duplicate
    }
    seen.add(key);
    deduped.push(diagnostic);
    if (deduped.length >= maxDiagnostics) {
      break;
    }
  }

  return deduped;
}

/**
 * Converts a TypeScript source position (offset) to line and column numbers.
 * TypeScript uses 0-based indexing, we convert to 1-based for human readability.
 */
function toDiagnosticLineAndColumn(file: ts.SourceFile | undefined, start: number | undefined): { line: number | null; column: number | null } {
  if (file == null || start == null) {
    return { line: null, column: null };
  }
  const position = file.getLineAndCharacterOfPosition(start);
  return {
    line: position.line + 1,
    column: position.character + 1,
  };
}

/**
 * Collects TypeScript diagnostics for the specified files.
 *
 * This function:
 * 1. Groups files by their tsconfig.json (or lack thereof)
 * 2. Creates a TypeScript program for each group
 * 3. Extracts diagnostics from pre-emit results
 * 4. Filters to only the requested files
 *
 * TypeScript's Sajax diagnostics API provides deep analysis including:
 * - Syntax errors
 * - Type errors
 * - Declaration file issues
 * - Configuration problems
 */
function collectTypeScriptDiagnosticsForFiles(request: CodeDiagnosticsRunRequest): CodeDiagnosticEntry[] {
  const selectedFiles = new Set(request.filePaths.map((filePath) => canonicalizePath(filePath)));
  const configGroups = new Map<string | null, string[]>();

  // Group files by their tsconfig.json
  for (const filePath of request.filePaths) {
    const configPath = ts.findConfigFile(dirname(filePath), ts.sys.fileExists, "tsconfig.json") ?? null;
    const group = configGroups.get(configPath) ?? [];
    group.push(filePath);
    configGroups.set(configPath, group);
  }

  const diagnostics: CodeDiagnosticEntry[] = [];

  // Process each config group separately
  for (const [configPath, groupedFiles] of configGroups.entries()) {
    let program: ts.Program;

    if (configPath == null) {
      // No tsconfig.json - use default compiler options
      program = ts.createProgram(groupedFiles, {
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2023,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      });
    } else {
      // Read and parse tsconfig.json
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (configFile.error != null) {
        const configLineAndColumn = toDiagnosticLineAndColumn(configFile.error.file, configFile.error.start);
        diagnostics.push({
          language: "typescript",
          severity: "error",
          filePath: canonicalizePath(configPath),
          message: ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
          code: String(configFile.error.code),
          source: "tsconfig",
          line: configLineAndColumn.line,
          column: configLineAndColumn.column,
        });
        continue;
      }

      // Parse config and create program
      const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
      program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: {
          ...parsed.options,
          noEmit: true,
        },
      });
    }

    // Get all pre-emit diagnostics (syntactic, semantic, declaration)
    const programDiagnostics = ts.getPreEmitDiagnostics(program);
    for (const diagnostic of programDiagnostics) {
      if (diagnostic.file == null) {
        continue;
      }
      const diagnosticFilePath = canonicalizePath(diagnostic.file.fileName);
      if (!selectedFiles.has(diagnosticFilePath)) {
        continue;
      }
      const lineAndColumn = toDiagnosticLineAndColumn(diagnostic.file, diagnostic.start);
      diagnostics.push({
        language: "typescript",
        severity: diagnostic.category === ts.DiagnosticCategory.Warning ? "warning" : "error",
        filePath: diagnosticFilePath,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        code: String(diagnostic.code),
        source: "typescript",
        line: lineAndColumn.line,
        column: lineAndColumn.column,
      });
    }
  }

  return diagnostics;
}

/**
 * Collects Python diagnostics by running py_compile on the specified files.
 *
 * This validates Python syntax without executing the code.
 * Returns a warning if py_compile is unavailable or returns non-zero status.
 */
async function collectPythonDiagnosticsForFiles(request: CodeDiagnosticsRunRequest): Promise<CodeDiagnosticEntry[]> {
  const diagnostics: CodeDiagnosticEntry[] = [];

  for (const filePath of request.filePaths) {
    // Run python3 -m py_compile to check syntax
    const child = spawn("python3", ["-m", "py_compile", filePath], {
      cwd: request.workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"] as const,
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });

    const exitCode = await new Promise<number>((resolve) => {
      child.on("close", (code) => resolve(code ?? 1));
    });

    // Handle tool unavailability or errors
    if (exitCode === 127 || stderr.includes("python3: command not found") || stderr.includes("no module named py_compile")) {
      diagnostics.push({
        language: "python",
        severity: "warning",
        filePath,
        message: `python diagnostics unavailable: python3 not found or py_compile module unavailable`,
        code: "python.runner_unavailable",
        source: "py_compile",
        line: null,
        column: null,
      });
      continue;
    }

    // No errors if exit code is 0
    if (exitCode === 0) {
      continue;
    }

    // Parse error output for line number
    const errorOutput = stderr.trim().length > 0 ? stderr.trim() : stdout.trim();
    const lineMatch = errorOutput.match(/line (\d+)/);
    diagnostics.push({
      language: "python",
      severity: "error",
      filePath,
      message: errorOutput.length > 0 ? errorOutput : "python compile failed",
      code: "python.compile_failed",
      source: "py_compile",
      line: lineMatch == null ? null : parseInt(lineMatch[1] ?? "0", 10),
      column: null,
    });
  }

  return diagnostics;
}

/**
 * Formats diagnostics summary into a human-readable feedback string.
 *
 * Returns null if there are no diagnostics to report.
 * Returns a string like:
 *   "Diagnostics: 2 errors, 1 warning across 2 file(s). First issue: src/app.ts:5:10 Cannot find name 'foo'."
 */
export function formatDiagnosticsFeedback(summary: CodeDiagnosticsSummary | null): string | null {
  if (summary == null || (summary.errorCount === 0 && summary.warningCount === 0)) {
    return null;
  }

  const first = summary.diagnostics[0];
  const counts = [
    summary.errorCount > 0 ? `${summary.errorCount} error${summary.errorCount === 1 ? "" : "s"}` : null,
    summary.warningCount > 0 ? `${summary.warningCount} warning${summary.warningCount === 1 ? "" : "s"}` : null,
  ].filter((value): value is string => value != null).join(", ");

  const location = first == null
    ? null
    : `${first.filePath}${first.line == null ? "" : `:${first.line}${first.column == null ? "" : `:${first.column}`}`}`;
  const firstSnippet = first == null ? null : `${location == null ? "" : `${location} `}${first.message}`.trim();
  return `Diagnostics: ${counts} across ${summary.diagnosticFileCount} file(s)${firstSnippet == null ? "" : `. First issue: ${firstSnippet}`}`;
}

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
export class CodeDiagnosticsService {
  private readonly workspaceRoot: string;
  private readonly maxDiagnostics: number;
  private readonly runTypeScript: (request: CodeDiagnosticsRunRequest) => readonly CodeDiagnosticEntry[];
  private readonly runPython: (request: CodeDiagnosticsRunRequest) => Promise<readonly CodeDiagnosticEntry[]>;

  /**
   * Creates a new CodeDiagnosticsService.
   *
   * @param options - Configuration options
   */
  public constructor(options: CodeDiagnosticsServiceOptions = {}) {
    this.workspaceRoot = canonicalizePath(options.workspaceRoot ?? process.cwd());
    this.maxDiagnostics = Math.max(1, options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS);
    this.runTypeScript = options.runTypeScript ?? collectTypeScriptDiagnosticsForFiles;
    this.runPython = options.runPython ?? collectPythonDiagnosticsForFiles;
  }

  /**
   * Collects diagnostics for the specified files.
   *
   * @param filePaths - Files to analyze
   * @returns Summary of diagnostics, or null if no files could be analyzed
   */
  public async collectForFiles(filePaths: readonly string[]): Promise<CodeDiagnosticsSummary | null> {
    // Normalize paths, filter to existing files within workspace
    const normalized = Array.from(new Set(filePaths
      .map((filePath) => canonicalizePath(filePath))
      .filter((filePath) => existsSync(filePath))
      .filter((filePath) => isWithinWorkspace(this.workspaceRoot, filePath))));

    // Separate by language
    const tsFiles = normalized.filter((filePath) => TYPESCRIPT_EXTENSIONS.has(extname(filePath).toLowerCase()));
    const pyFiles = normalized.filter((filePath) => PYTHON_EXTENSIONS.has(extname(filePath).toLowerCase()));
    const checkedFileCount = tsFiles.length + pyFiles.length;

    if (checkedFileCount === 0) {
      return null;
    }

    const diagnostics: CodeDiagnosticEntry[] = [];
    const runnerWarnings: string[] = [];

    // Run TypeScript diagnostics
    if (tsFiles.length > 0) {
      try {
        diagnostics.push(...this.runTypeScript({
          workspaceRoot: this.workspaceRoot,
          filePaths: tsFiles,
          maxDiagnostics: this.maxDiagnostics,
        }));
      } catch (error) {
        runnerWarnings.push(`typescript diagnostics failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Run Python diagnostics
    if (pyFiles.length > 0) {
      try {
        const pyResults = await this.runPython({
          workspaceRoot: this.workspaceRoot,
          filePaths: pyFiles,
          maxDiagnostics: this.maxDiagnostics,
        });
        diagnostics.push(...pyResults);
      } catch (error) {
        runnerWarnings.push(`python diagnostics failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Deduplicate and limit
    const dedupedDiagnostics = dedupeDiagnostics(diagnostics, this.maxDiagnostics);
    const diagnosticFileCount = new Set(dedupedDiagnostics.map((diagnostic) => diagnostic.filePath)).size;
    const errorCount = dedupedDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const warningCount = dedupedDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
    const languages = Array.from(new Set(dedupedDiagnostics.map((diagnostic) => diagnostic.language)));

    return {
      checkedFileCount,
      diagnosticFileCount,
      errorCount,
      warningCount,
      languages,
      diagnostics: dedupedDiagnostics,
      runnerWarnings,
    };
  }
}