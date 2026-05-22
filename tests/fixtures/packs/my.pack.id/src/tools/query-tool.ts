import { defineTool } from "@platform/plugin-sdk";

export const queryTool = defineTool({
  toolId: "my.pack.id.query",
  name: "Query",
  description: "Execute a query",
  async execute(input: { query: string }) {
    return { result: `Query executed: ${input.query}` };
  },
});