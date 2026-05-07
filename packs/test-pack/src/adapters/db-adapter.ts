import { defineAdapter } from "@platform/plugin-sdk";

export const dbAdapter = defineAdapter({
  adapterId: "test-pack.db",
  name: "Database Adapter",
  async execute(input: { query: string }) {
    return { rows: [], affected: 0 };
  },
});