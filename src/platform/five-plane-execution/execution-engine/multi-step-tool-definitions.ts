/**
 * @fileoverview Multi-Step Tool Definitions
 *
 * Tool definitions for multi-step orchestration.
 * These are static schemas used to define the tools available to LLM agents.
 */

export interface MultiStepToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MULTI_STEP_TOOL_DEFINITIONS: readonly MultiStepToolDefinition[] = Object.freeze([
  {
    name: "todo_write",
    description: "Create, update, delete, list, or fetch structured todos for the current task.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string" },
        sessionId: { type: "string" },
        todoId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        priority: { type: "number" },
        parentTodoId: { type: "string" },
        progressPercent: { type: "number" },
        filterStatus: { type: "string" },
        filterSessionId: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "question",
    description: "Ask a human clarification question when the task cannot safely proceed.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        context: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "web_search",
    description: "Search the public web for recent or relevant information.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        language: { type: "string" },
        timeoutMs: { type: "number" },
      },
      required: ["query"],
      additionalProperties: true,
    },
  },
  {
    name: "web_fetch",
    description: "Fetch a web page by URL and return sanitized content.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
      additionalProperties: true,
    },
  },
  {
    name: "git",
    description: "Run a git command inside the current repository root with sandboxed path scoping.",
    inputSchema: {
      type: "object",
      properties: {
        args: {
          type: "array",
          items: { type: "string" },
        },
        cwd: { type: "string" },
        timeoutMs: { type: "number" },
      },
      required: ["args"],
      additionalProperties: false,
    },
  },
  {
    name: "repo-map",
    description: "Build a semantic repository map and search for relevant files or symbols.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        rootPath: { type: "string" },
        currentFile: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "spawn-agent",
    description: "Delegate a bounded subtask to a local child agent loop and return its result.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string" },
        roleId: { type: "string" },
        stepId: { type: "string" },
        routingReason: { type: "string" },
        tools: {
          type: "array",
          items: { type: "string" },
        },
        maxIterations: { type: "number" },
      },
      required: ["request"],
      additionalProperties: true,
    },
  },
  {
    name: "edit_replace",
    description: "Replace a text segment in a file using multi-stage fuzzy matching.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string" },
        oldString: { type: "string" },
        newString: { type: "string" },
        beforeAnchor: { type: "string" },
        afterAnchor: { type: "string" },
      },
      required: ["filePath", "oldString", "newString"],
      additionalProperties: true,
    },
  },
  {
    name: "batch_edit_replace",
    description: "Apply multiple edit_replace operations atomically on the same file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              oldString: { type: "string" },
              newString: { type: "string" },
              beforeAnchor: { type: "string" },
              afterAnchor: { type: "string" },
            },
          },
        },
      },
      required: ["filePath", "edits"],
      additionalProperties: true,
    },
  },
  {
    name: "multifile_edit_replace",
    description: "Apply edit_replace operations across multiple files atomically.",
    inputSchema: {
      type: "object",
      properties: {
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filePath: { type: "string" },
              oldString: { type: "string" },
              newString: { type: "string" },
              beforeAnchor: { type: "string" },
              afterAnchor: { type: "string" },
            },
          },
        },
      },
      required: ["edits"],
      additionalProperties: true,
    },
  },
  {
    name: "read",
    description: "Read file contents or directory listings.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        offset: { type: "number" },
        limit: { type: "number" },
      },
      required: ["path"],
      additionalProperties: true,
    },
  },
  {
    name: "glob",
    description: "List files matching a glob pattern.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        basePath: { type: "string" },
      },
      required: ["pattern"],
      additionalProperties: true,
    },
  },
  {
    name: "grep",
    description: "Search for patterns in files.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        isRegex: { type: "boolean" },
        caseSensitive: { type: "boolean" },
        matchAll: { type: "boolean" },
      },
      required: ["pattern", "path"],
      additionalProperties: true,
    },
  },
  {
    name: "write",
    description: "Write content to a file.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        append: { type: "boolean" },
      },
      required: ["path", "content"],
      additionalProperties: true,
    },
  },
].map((tool) => Object.freeze({
  ...tool,
  inputSchema: Object.freeze(tool.inputSchema),
})));

export function getMultiStepToolDefinitions(toolNames: readonly string[]): MultiStepToolDefinition[] {
  const allowed = new Set(toolNames);
  return MULTI_STEP_TOOL_DEFINITIONS.filter((tool) => allowed.has(tool.name));
}
