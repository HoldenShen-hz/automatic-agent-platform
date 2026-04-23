/**
 * Tag Builder Utility
 *
 * Provides consistent tag generation for cache invalidation.
 * Tags follow a namespace:identifier pattern for efficient
 * batch invalidation.
 */
export class TagBuilder {
    /**
     * Creates a session-scoped tag.
     */
    session(sessionId) {
        return `session:${sessionId}`;
    }
    /**
     * Creates a file-scoped tag.
     */
    file(normalizedPath) {
        return `file:${normalizedPath}`;
    }
    /**
     * Creates a tool-scoped tag.
     */
    tool(toolName) {
        return `tool:${toolName}`;
    }
    /**
     * Creates a repository-scoped tag.
     */
    repo(repoId) {
        return `repo:${repoId}`;
    }
    /**
     * Creates an instruction-scoped tag.
     */
    instruction(fingerprint) {
        return `instruction:${fingerprint}`;
    }
    /**
     * Creates a model-scoped tag.
     */
    model(modelName) {
        return `model:${modelName}`;
    }
    /**
     * Creates a division-scoped tag.
     */
    division(divisionId) {
        return `division:${divisionId}`;
    }
    /**
     * Creates tags for a tool call context.
     */
    toolContext(toolName, normalizedArgs, sessionId) {
        const tags = [this.tool(toolName)];
        if (sessionId) {
            tags.push(this.session(sessionId));
        }
        // Add file tags if present
        if (typeof normalizedArgs.path === 'string') {
            tags.push(this.file(normalizedArgs.path));
        }
        if (typeof normalizedArgs.file === 'string') {
            tags.push(this.file(normalizedArgs.file));
        }
        return tags;
    }
    /**
     * Creates tags for a prompt context.
     */
    promptContext(sessionId, modelName, divisionId) {
        const tags = [
            this.session(sessionId),
            this.model(modelName),
        ];
        if (divisionId) {
            tags.push(this.division(divisionId));
        }
        return tags;
    }
}
export const tagBuilder = new TagBuilder();
//# sourceMappingURL=tag-builder.js.map