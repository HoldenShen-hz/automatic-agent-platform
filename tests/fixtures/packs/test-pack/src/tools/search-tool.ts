import { defineTool } from "@platform/plugin-sdk";

export const searchTool = defineTool({
  toolId: "test-pack.search",
  name: "Search",
  description: "Search resources",
  async execute(input: { query: string }) {
    return { results: [] };
  },
});