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
  session(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Creates a file-scoped tag.
   */
  file(normalizedPath: string): string {
    return `file:${normalizedPath}`;
  }

  /**
   * Creates a tool-scoped tag.
   */
  tool(toolName: string): string {
    return `tool:${toolName}`;
  }

  /**
   * Creates a repository-scoped tag.
   */
  repo(repoId: string): string {
    return `repo:${repoId}`;
  }

  /**
   * Creates an instruction-scoped tag.
   */
  instruction(fingerprint: string): string {
    return `instruction:${fingerprint}`;
  }

  /**
   * Creates a model-scoped tag.
   */
  model(modelName: string): string {
    return `model:${modelName}`;
  }

  /**
   * Creates a division-scoped tag.
   */
  division(divisionId: string): string {
    return `division:${divisionId}`;
  }

  /**
   * Creates tags for a tool call context.
   */
  toolContext(
    toolName: string,
    normalizedArgs: Record<string, unknown>,
    sessionId?: string
  ): string[] {
    const tags: string[] = [this.tool(toolName)];

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
  promptContext(
    sessionId: string,
    modelName: string,
    divisionId?: string
  ): string[] {
    const tags: string[] = [
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
