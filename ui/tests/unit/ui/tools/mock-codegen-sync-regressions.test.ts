import { describe, expect, it } from "vitest";

import { resolveMockRequest } from "../../../../tools/mock-server/src";
import { parseOpenApiSpec } from "../../../../tools/codegen/src";
import { ConflictResolver } from "../../../../packages/shared/sync/src/conflict-resolver";

describe("UI tooling regressions", () => {
  it("mock server resolves extended API surfaces beyond dashboard/tasks/workflows", () => {
    expect(resolveMockRequest("/api/v1/approvals")).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "pending" })]),
    );
    expect(resolveMockRequest("/api/v1/meta/contract-version")).toEqual(
      expect.objectContaining({ contractVersion: "1.0" }),
    );
  });

  it("codegen emits DTOs, endpoint clients and query key factories", () => {
    const generated = parseOpenApiSpec({
      openapi: "3.1.0",
      info: { title: "AA", version: "1.0.0" },
      paths: {
        "/api/v1/tasks": {
          get: {
            operationId: "listTasks",
            parameters: [{ name: "tenantId", in: "query", schema: { type: "string" } }],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: { $ref: "#/components/schemas/task" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          task: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    });

    expect(generated.dtoTypes).toContain("export type Task");
    expect(generated.endpointClients).toContain("export async function listTasks");
    expect(generated.queryKeys).toContain("listTasksQueryKey");
  });

  it("conflict resolver supports CRDT-style merge semantics", () => {
    const resolver = new ConflictResolver();
    const resolved = resolver.resolve(
      { id: "doc", version: 1, status: "server" },
      { id: "doc", version: 2, status: "local" },
      "merge",
      {
        lamportTimestamp: 1,
        vectorClock: { status: { actorId: "server", timestamp: 1 } },
      },
      {
        lamportTimestamp: 2,
        vectorClock: { status: { actorId: "local", timestamp: 2 } },
      },
    );

    expect(resolved).toEqual(expect.objectContaining({ status: "local" }));
  });
});
