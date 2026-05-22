import { defineTool } from "@platform/plugin-sdk";

export const queryTool = defineTool({
  toolId: "123test.query",
  name: "Query",
  description: "Execute a query",
  async execute(input: { query: string }) {
    return { result: `Query executed: ${input.query}` };
  },
});