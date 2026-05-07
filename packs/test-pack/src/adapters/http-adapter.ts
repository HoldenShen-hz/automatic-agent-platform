import { defineAdapter } from "@platform/plugin-sdk";

export const httpAdapter = defineAdapter({
  adapterId: "test-pack.http",
  name: "HTTP Adapter",
  async execute(input: { url: string; method: string }) {
    return { status: 200, body: "OK" };
  },
});