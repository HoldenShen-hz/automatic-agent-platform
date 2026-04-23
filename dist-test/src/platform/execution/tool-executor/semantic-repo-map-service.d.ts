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
    references: readonly {
        filePath: string;
        line: number;
        column: number;
    }[];
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
export declare function extractImports(content: string): {
    imports: string[];
    dynamicImports: string[];
};
/**
 * Extracts symbol definitions from JavaScript/TypeScript content using regex patterns.
 * Identifies functions, classes, interfaces, types, and top-level constants.
 *
 * @param content - Source file content to analyze
 * @param filePath - Path to the source file (for tracking symbol location)
 * @returns Array of extracted symbol definitions
 */
export declare function extractSymbols(content: string, filePath: string): RepoSymbol[];
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
export declare function computeFileRelevance(file: RepoFileNode, query: SemanticQuery): number;
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
export declare function computeSymbolRelevance(symbol: RepoSymbol, query: SemanticQuery): number;
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
export declare class SemanticRepoMapService {
    private readonly rootPath;
    private readonly cacheTtlMs;
    private repoMap;
    private lastBuiltAt;
    /**
     * Creates a new SemanticRepoMapService.
     *
     * @param rootPath - Root directory of the repository to map
     * @param cacheTtlMs - How long to cache the map before rebuilding (default: 60000ms)
     */
    constructor(rootPath: string, cacheTtlMs?: number);
    /**
     * Builds or returns the cached repository map.
     *
     * If the cached map is still valid (within TTL), returns it.
     * Otherwise, rescans the entire repository and rebuilds the map.
     */
    buildMap(): SemanticRepoMap;
    /**
     * Recursively scans a directory for source files.
     *
     * Skips common non-source directories:
     * - node_modules
     * - dist
     * - build
     * - Hidden directories (starting with .)
     */
    private scanDirectory;
    /**
     * Processes a single source file, extracting its imports, symbols, and references.
     */
    private processFile;
    /**
     * Performs semantic search across the repository.
     *
     * Searches both files and symbols, ranking results by relevance.
     * Results are sorted by relevance score in descending order.
     */
    search(query: SemanticQuery): SemanticSearchResult;
    /**
     * Gets all files that the given file imports (direct dependencies).
     */
    getFileDependencies(filePath: string): RepoFileNode[];
    /**
     * Gets all files that import the given file (dependents/reverse dependencies).
     */
    getFileDependents(filePath: string): RepoFileNode[];
    /**
     * Gets a symbol definition by name and optional file path.
     *
     * @param name - Symbol name to look up
     * @param filePath - Optional file path to disambiguate (if omitted, returns first match)
     */
    getSymbol(name: string, filePath?: string): RepoSymbol | null;
    /**
     * Gets all references to a symbol across the repository.
     */
    getSymbolReferences(symbolName: string): RepoSymbol["references"];
    /**
     * Forces a cache invalidation, causing the next buildMap() call to rescan.
     */
    invalidateCache(): void;
    /**
     * Gets statistics about the repository.
     */
    getStatistics(): {
        totalFiles: number;
        totalSymbols: number;
        totalReferences: number;
        fileTypes: Map<string, number>;
        symbolKinds: Map<string, number>;
    };
}
