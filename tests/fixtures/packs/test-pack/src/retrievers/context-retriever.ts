import { defineRetriever } from "@platform/plugin-sdk";

export const contextRetriever = defineRetriever({
  retrieverId: "test-pack.context",
  name: "Context Retriever",
  async retrieve(input: { query: string }) {
    return { documents: [] };
  },
});