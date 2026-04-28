/**
 * Semantic Repo Map Service
 *
 * Provides semantic repository mapping with pattern-based analysis, enabling:
 * - File dependency graphs (imports/requires tracking)
 * - Symbol definition and reference tracking
 * - Relevance-based file and symbol ranking for search
 *
 * Note: This implementation uses pattern-based analysis instead of tree-sitter
 * to avoid external runtime dependencies. It supports JavaScript/TypeScript
 * import/require patterns and provides meaningful semantic mapping without
 * requiring a full AST parser.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const semanticRepoMapLogger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Represents a source file in the repository map.
 */
export interface RepoFileNode {
  /** Absolute path to the file */
  filePath: string;
  /** Filename without path */
  fileName: string;
  /** File extension including the dot (e.g., ".ts") */
  extension: string;
  /** Path relative to the repository root */
  relativePath: string;
  /** Symbols exported by this file */
  exports: readonly string[];
  /** Module paths imported by this file */
  imports: readonly string[];
  /** Paths of files that import this file */
  referencedBy: string[];
  /** Depth in the directory tree from root */
  depth: number;
}

/**
 * Represents a symbol (function, class, interface, etc.) in the repository.
 */
export interface RepoSymbol {
  /** Name of the symbol */
  name: string;
  /** Kind of symbol (function, class, interface, type, variable, constant, enum) */
  kind: "function" | "class" | "interface" | "type" | "variable" | "constant" | "enum";
  /** Path to the file containing this symbol */
  filePath: string;
  /** Line number where the symbol is defined (1-indexed) */
  line: number;
  /** Column number where the symbol is defined (1-indexed) */
  column: number;
  /** Locations where this symbol is referenced */
  references: readonly { filePath: string; line: number; column: number }[];
}

/**
 * Represents a dependency relationship between two files.
 */
export interface RepoReference {
  /** Source file path */
  from: string;
  /** Target file path (resolved module path) */
  to: string;
  /** Type of import (static, dynamic, require, type import) */
  kind: "import" | "require" | "typeImport" | "dynamicImport";
}

/**
 * Query parameters for semantic search.
 */
export interface SemanticQuery {
  /** Search query string */
  query: string;
  /** Optional: only return results relevant to this file */
  currentFile?: string;
  /** Maximum number of results to return (default: 20) */
  limit?: number;
}

/**
 * Result of a semantic search operation.
 */
export interface SemanticSearchResult {
  /** Files matching the query, sorted by relevance */
  files: RepoFileNode[];
  /** Symbols matching the query, sorted by relevance */
  symbols: RepoSymbol[];
  /** Relevance scores keyed by file path or "name@filePath" for symbols */
  relevanceScores: Map<string, number>;
}

/**
 * Complete repository map containing all files, symbols, and references.
 */
export interface SemanticRepoMap {
  /** Map of file path to file node */
  files: Map<string, RepoFileNode>;
  /** Map of "name@filePath" to symbol */
  symbols: Map<string, RepoSymbol>;
  /** All reference relationships in the repository */
  references: readonly RepoReference[];
  /** Root path this map was built from */
  rootPath: string;
}

/**
 * Extracts all import statements from JavaScript/TypeScript content.
 * Handles ES6 imports, CommonJS requires, and dynamic imports.
 *
 * @param content - Source file content to analyze
 * @returns Object containing static imports and dynamic imports
 */
export function extractImports(content: string): { imports: string[]; dynamicImports: string[] } {
  const imports: string[] = [];
  const dynamicImports: string[] = [];

  // ES6 import patterns: import x from 'path', import { x } from 'path', import * as x from 'path'
  const es6ImportRegex = /(?:import\s+(?:(?:[\w*{}\s,]+\s+from\s+)?['"])([^'"]+)['"])/g;
  let match;
  while ((match = es6ImportRegex.exec(content)) !== null) {
    imports.push(match[1]!);
  }

  // CommonJS require patterns: require('path')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]!);
  }

  // Dynamic imports: import('path')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    dynamicImports.push(match[1]!);
  }

  return { imports, dynamicImports };
}

/**
 * Extracts symbol definitions from JavaScript/TypeScript content using regex patterns.
 * Identifies functions, classes, interfaces, types, and top-level constants.
 *
 * @param content - Source file content to analyze
 * @param filePath - Path to the source file (for tracking symbol location)
 * @returns Array of extracted symbol definitions
 */
export function extractSymbols(content: string, filePath: string): RepoSymbol[] {
  const symbols: RepoSymbol[] = [];
  const lines = content.split("\n");

  // Function declarations: function name(...) or async function name(...)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const matches = line.matchAll(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/g);
    for (const match of matches) {
      symbols.push({
        name: match[1]!,
        kind: "function",
        filePath,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        references: [],
      });
    }
  }

  // Class declarations: class Name or export class Name
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const matches = line.matchAll(/^\s*(?:export\s+)?class\s+(\w+)/g);
    for (const match of matches) {
      symbols.push({
        name: match[1]!,
        kind: "class",
        filePath,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        references: [],
      });
    }
  }

  // Interface declarations: interface Name or export interface Name
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const matches = line.matchAll(/^\s*(?:export\s+)?interface\s+(\w+)/g);
    for (const match of matches) {
      symbols.push({
        name: match[1]!,
        kind: "interface",
        filePath,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        references: [],
      });
    }
  }

  // Type aliases: type Name = ...
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const matches = line.matchAll(/^\s*(?:export\s+)?type\s+(\w+)/g);
    for (const match of matches) {
      symbols.push({
        name: match[1]!,
        kind: "type",
        filePath,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        references: [],
      });
    }
  }

  // Const declarations at top level (not inside functions/classes)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Skip lines containing braces as they're likely inside functions/classes
    if (line.includes("{")) continue;
    const matches = line.matchAll(/^\s*(?:export\s+)?const\s+(\w+)/g);
    for (const match of matches) {
      symbols.push({
        name: match[1]!,
        kind: "constant",
        filePath,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        references: [],
      });
    }
  }

  return symbols;
}

/**
 * Resolves a module import path to an absolute file path.
 * Handles relative imports, node_modules resolution, and src/ path aliases.
 *
 * @param importPath - The module path as written in the import statement
 * @param fromFile - The file containing the import
 * @param rootPath - Repository root path
 * @returns Resolved absolute path or null if not resolvable
 */
function resolveModulePath(importPath: string, fromFile: string, rootPath: string): string | null {
  // Handle relative imports (starting with .)
  if (importPath.startsWith(".")) {
    const baseDir = fromFile.substring(0, fromFile.lastIndexOf("/"));
    const resolved = join(baseDir, importPath);

    // Try adding common extensions
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
    for (const ext of extensions) {
      if (existsSync(resolved + ext)) {
        return resolved + ext;
      }
    }

    // Try as directory with index file
    for (const ext of extensions) {
      if (existsSync(resolved + "/index" + ext)) {
        return resolved + "/index" + ext;
      }
    }

    return resolved;
  }

  // Handle absolute imports from node_modules
  const absolutePath = join(rootPath, "node_modules", importPath);
  if (existsSync(absolutePath)) {
    return absolutePath;
  }

  // Try src path for src/ aliases
  const srcPath = join(rootPath, "src", importPath);
  if (existsSync(srcPath)) {
    return srcPath;
  }

  return null;
}

/**
 * Computes a relevance score between a file and a semantic query.
 * Higher scores indicate better match.
 *
 * Scoring factors:
 * - Filename contains query term: +0.4
 * - Path contains query term: +0.2
 * - Export name matches query: +0.3
 * - Current file depends on this file: +0.1
 *
 * @param file - The file node to score
 * @param query - The search query
 * @returns Relevance score between 0 and 1
 */
export function computeFileRelevance(file: RepoFileNode, query: SemanticQuery): number {
  const queryLower = query.query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  let score = 0;

  // Direct filename match
  if (queryTerms.some((term) => file.fileName.toLowerCase().includes(term))) {
    score += 0.4;
  }

  // Path match
  const pathLower = file.relativePath.toLowerCase();
  if (queryTerms.some((term) => pathLower.includes(term))) {
    score += 0.2;
  }

  // Export match
  if (file.exports.some((exp) => queryTerms.some((term) => exp.toLowerCase().includes(term)))) {
    score += 0.3;
  }

  // Boost files that current file depends on
  if (query.currentFile) {
    const currentNode = file.referencedBy.includes(query.currentFile);
    if (currentNode) {
      score += 0.1;
    }
  }

  return Math.min(1.0, score);
}

/**
 * Computes a relevance score between a symbol and a semantic query.
 *
 * Scoring factors:
 * - Symbol name matches query: +0.5
 * - File path matches query: +0.2
 * - Symbol kind matches query: +0.2
 * - Has references: +0.1 (with diminishing returns)
 *
 * @param symbol - The symbol to score
 * @param query - The search query
 * @returns Relevance score between 0 and 1
 */
export function computeSymbolRelevance(symbol: RepoSymbol, query: SemanticQuery): number {
  const queryLower = query.query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  let score = 0;

  // Symbol name match (highest weight)
  if (queryTerms.some((term) => symbol.name.toLowerCase().includes(term))) {
    score += 0.5;
  }

  // File path match
  if (queryTerms.some((term) => symbol.filePath.toLowerCase().includes(term))) {
    score += 0.2;
  }

  // Kind match (e.g., "function" in query)
  if (queryTerms.some((term) => symbol.kind.toLowerCase().includes(term))) {
    score += 0.2;
  }

  // Reference count boost (symbols with references are often more important)
  if (symbol.references.length > 0) {
    score += Math.min(0.1, symbol.references.length * 0.02);
  }

  return Math.min(1.0, score);
}

/**
 * SemanticRepoMapService builds and maintains a semantic map of a repository.
 *
 * The service scans a directory tree, extracting:
 * - File nodes with their imports and exports
 * - Symbol definitions (functions, classes, interfaces, types, constants)
 * - Reference relationships between files
 *
 * The map is cached and only rebuilt when stale (controlled by cacheTtlMs).
 */
export class SemanticRepoMapService {
  private repoMap: SemanticRepoMap | null = null;
  private lastBuiltAt: number = 0;

  /**
   * Creates a new SemanticRepoMapService.
   *
   * @param rootPath - Root directory of the repository to map
   * @param cacheTtlMs - How long to cache the map before rebuilding (default: 60000ms)
   */
  public constructor(
    private readonly rootPath: string,
    private readonly cacheTtlMs: number = 60_000,
  ) {}

  /**
   * Builds or returns the cached repository map.
   *
   * If the cached map is still valid (within TTL), returns it.
   * Otherwise, rescans the entire repository and rebuilds the map.
   */
  public buildMap(): SemanticRepoMap {
    const now = Date.now();
    if (this.repoMap && now - this.lastBuiltAt < this.cacheTtlMs) {
      return this.repoMap;
    }

    const files = new Map<string, RepoFileNode>();
    const symbols = new Map<string, RepoSymbol>();
    const references: RepoReference[] = [];

    // Recursively scan the directory tree
    this.scanDirectory(this.rootPath, 0, files, symbols, references);

    // Build bidirectional reference graph
    for (const file of files.values()) {
      for (const ref of references) {
        if (ref.from === file.filePath && files.has(ref.to)) {
          const targetFile = files.get(ref.to)!;
          targetFile.referencedBy.push(file.filePath);
        }
      }
    }

    this.repoMap = {
      files,
      symbols,
      references,
      rootPath: this.rootPath,
    };
    this.lastBuiltAt = now;

    return this.repoMap;
  }

  /**
   * Recursively scans a directory for source files.
   *
   * Skips common non-source directories:
   * - node_modules
   * - dist
   * - build
   * - Hidden directories (starting with .)
   */
  private scanDirectory(
    dirPath: string,
    depth: number,
    files: Map<string, RepoFileNode>,
    symbols: Map<string, RepoSymbol>,
    references: RepoReference[],
  ): void {
    let entries;
    try {
      entries = readdirSync(dirPath);
    } catch (err) {
      semanticRepoMapLogger.warn("semantic_repo_map: failed to read directory", { error: err instanceof Error ? err.message : String(err), dirPath });
      return; // Skip inaccessible directories
    }

    for (const entry of entries) {
      // Skip common ignore patterns
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist" || entry === "build") {
        continue;
      }

      const fullPath = join(dirPath, entry);

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          this.scanDirectory(fullPath, depth + 1, files, symbols, references);
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase();
          if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(ext)) {
            this.processFile(fullPath, depth, files, symbols, references);
          }
        }
      } catch (err) {
        semanticRepoMapLogger.warn("semantic_repo_map: failed to stat file", { error: err instanceof Error ? err.message : String(err), fullPath });
        // Skip files we can't access
      }
    }
  }

  /**
   * Processes a single source file, extracting its imports, symbols, and references.
   */
  private processFile(
    filePath: string,
    depth: number,
    files: Map<string, RepoFileNode>,
    symbols: Map<string, RepoSymbol>,
    references: RepoReference[],
  ): void {
    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (err) {
      semanticRepoMapLogger.warn("semantic_repo_map: failed to read file", { error: err instanceof Error ? err.message : String(err), filePath });
      return;
    }

    const relativePath = relative(this.rootPath, filePath).replace(/\\/g, "/");
    const { imports, dynamicImports } = extractImports(content);
    const extractedSymbols = extractSymbols(content, filePath);

    const fileName = filePath.split("/").pop() ?? filePath;

    const node: RepoFileNode = {
      filePath,
      fileName,
      extension: extname(filePath),
      relativePath,
      exports: [], // Could be enhanced with export analysis
      imports: [...imports, ...dynamicImports],
      referencedBy: [],
      depth,
    };

    files.set(filePath, node);

    // Add symbols to the global symbol map (keyed by "name@filePath")
    for (const symbol of extractedSymbols) {
      symbols.set(`${symbol.name}@${filePath}`, symbol);
    }

    // Add reference relationships for static imports
    for (const imp of imports) {
      const resolved = resolveModulePath(imp, filePath, this.rootPath);
      if (resolved) {
        references.push({
          from: filePath,
          to: resolved,
          kind: "import",
        });
      }
    }

    // Add reference relationships for dynamic imports
    for (const imp of dynamicImports) {
      const resolved = resolveModulePath(imp, filePath, this.rootPath);
      if (resolved) {
        references.push({
          from: filePath,
          to: resolved,
          kind: "dynamicImport",
        });
      }
    }
  }

  /**
   * Performs semantic search across the repository.
   *
   * Searches both files and symbols, ranking results by relevance.
   * Results are sorted by relevance score in descending order.
   */
  public search(query: SemanticQuery): SemanticSearchResult {
    const map = this.buildMap();
    const limit = query.limit ?? 20;

    const fileResults: RepoFileNode[] = [];
    const symbolResults: RepoSymbol[] = [];
    const relevanceScores = new Map<string, number>();

    // Search files
    for (const file of map.files.values()) {
      const score = computeFileRelevance(file, query);
      if (score > 0) {
        fileResults.push(file);
        relevanceScores.set(file.filePath, score);
      }
    }

    // Search symbols
    for (const symbol of map.symbols.values()) {
      const score = computeSymbolRelevance(symbol, query);
      if (score > 0) {
        symbolResults.push(symbol);
        relevanceScores.set(`${symbol.name}@${symbol.filePath}`, score);
      }
    }

    // Sort files by relevance (highest first)
    fileResults.sort((a, b) => {
      const scoreA = relevanceScores.get(a.filePath) ?? 0;
      const scoreB = relevanceScores.get(b.filePath) ?? 0;
      return scoreB - scoreA;
    });

    // Sort symbols by relevance (highest first)
    symbolResults.sort((a, b) => {
      const scoreA = relevanceScores.get(`${a.name}@${a.filePath}`) ?? 0;
      const scoreB = relevanceScores.get(`${b.name}@${b.filePath}`) ?? 0;
      return scoreB - scoreA;
    });

    return {
      files: fileResults.slice(0, limit),
      symbols: symbolResults.slice(0, limit),
      relevanceScores,
    };
  }

  /**
   * Gets all files that the given file imports (direct dependencies).
   */
  public getFileDependencies(filePath: string): RepoFileNode[] {
    const map = this.buildMap();
    const node = map.files.get(filePath);
    if (!node) {
      return [];
    }

    return node.imports
      .map((imp) => resolveModulePath(imp, filePath, this.rootPath))
      .filter((resolved): resolved is string => resolved !== null)
      .map((resolved) => map.files.get(resolved))
      .filter((f): f is RepoFileNode => f !== undefined);
  }

  /**
   * Gets all files that import the given file (dependents/reverse dependencies).
   */
  public getFileDependents(filePath: string): RepoFileNode[] {
    const map = this.buildMap();
    const node = map.files.get(filePath);
    if (!node) {
      return [];
    }

    return node.referencedBy
      .map((refPath) => map.files.get(refPath))
      .filter((f): f is RepoFileNode => f !== undefined);
  }

  /**
   * Gets a symbol definition by name and optional file path.
   *
   * @param name - Symbol name to look up
   * @param filePath - Optional file path to disambiguate (if omitted, returns first match)
   */
  public getSymbol(name: string, filePath?: string): RepoSymbol | null {
    const map = this.buildMap();
    if (filePath) {
      return map.symbols.get(`${name}@${filePath}`) ?? null;
    }

    // Find first symbol with this name
    for (const symbol of map.symbols.values()) {
      if (symbol.name === name) {
        return symbol;
      }
    }

    return null;
  }

  /**
   * Gets all references to a symbol across the repository.
   */
  public getSymbolReferences(symbolName: string): RepoSymbol["references"] {
    const map = this.buildMap();
    const references: { filePath: string; line: number; column: number }[] = [];

    for (const symbol of map.symbols.values()) {
      if (symbol.name === symbolName) {
        references.push(...symbol.references);
      }
    }

    return references;
  }

  /**
   * Forces a cache invalidation, causing the next buildMap() call to rescan.
   */
  public invalidateCache(): void {
    this.repoMap = null;
    this.lastBuiltAt = 0;
  }

  /**
   * Gets statistics about the repository.
   */
  public getStatistics(): {
    totalFiles: number;
    totalSymbols: number;
    totalReferences: number;
    fileTypes: Map<string, number>;
    symbolKinds: Map<string, number>;
  } {
    const map = this.buildMap();

    const fileTypes = new Map<string, number>();
    const symbolKinds = new Map<string, number>();

    for (const file of map.files.values()) {
      const ext = file.extension;
      fileTypes.set(ext, (fileTypes.get(ext) ?? 0) + 1);
    }

    for (const symbol of map.symbols.values()) {
      symbolKinds.set(symbol.kind, (symbolKinds.get(symbol.kind) ?? 0) + 1);
    }

    return {
      totalFiles: map.files.size,
      totalSymbols: map.symbols.size,
      totalReferences: map.references.length,
      fileTypes,
      symbolKinds,
    };
  }
}
