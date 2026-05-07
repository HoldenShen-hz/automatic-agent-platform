import { defineTool } from "@platform/plugin-sdk";

export const transformTool = defineTool({
  toolId: "test-pack.transform",
  name: "Transform",
  description: "Transform data",
  async execute(input: { data: unknown }) {
    return { result: JSON.stringify(input.data) };
  },
});