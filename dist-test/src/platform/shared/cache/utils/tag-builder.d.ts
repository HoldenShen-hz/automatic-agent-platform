/**
 * Tag Builder Utility
 *
 * Provides consistent tag generation for cache invalidation.
 * Tags follow a namespace:identifier pattern for efficient
 * batch invalidation.
 */
export declare class TagBuilder {
    /**
     * Creates a session-scoped tag.
     */
    session(sessionId: string): string;
    /**
     * Creates a file-scoped tag.
     */
    file(normalizedPath: string): string;
    /**
     * Creates a tool-scoped tag.
     */
    tool(toolName: string): string;
    /**
     * Creates a repository-scoped tag.
     */
    repo(repoId: string): string;
    /**
     * Creates an instruction-scoped tag.
     */
    instruction(fingerprint: string): string;
    /**
     * Creates a model-scoped tag.
     */
    model(modelName: string): string;
    /**
     * Creates a division-scoped tag.
     */
    division(divisionId: string): string;
    /**
     * Creates tags for a tool call context.
     */
    toolContext(toolName: string, normalizedArgs: Record<string, unknown>, sessionId?: string): string[];
    /**
     * Creates tags for a prompt context.
     */
    promptContext(sessionId: string, modelName: string, divisionId?: string): string[];
}
export declare const tagBuilder: TagBuilder;
