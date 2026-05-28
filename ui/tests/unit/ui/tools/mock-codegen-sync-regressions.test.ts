import { describe, expect, it } from "vitest";

import { resolveMockRequest } from "../../../../tools/mock-server/src";
import { generateBindingsFromOpenApi } from "../../../../tools/codegen/src";
import { ConflictResolver } from "../../../../packages/shared/sync/src/conflict-resolver";

describe("UI tooling regressions", () => {
  it("mock server resolves extended API surfaces beyond dashboard/tasks/workflows", () => {
    expect(resolveMockRequest("/api/v1/approvals")).toEqual(
      expect.arrayContaining([expect.objectContaining({ approvalId: "approval-1", riskLevel: "critical" })]),
    );
    expect(resolveMockRequest("/api/v1/meta/contract-version")).toEqual(
      expect.objectContaining({ contractVersion: "2026-04-01" }),
    );
  });

  it("codegen emits DTOs, endpoint clients and query key factories", () => {
    const generated = generateBindingsFromOpenApi({
      paths: {
        "/api/v1/tasks": {
          get: {
            operationId: "listTasks",
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

    expect(generated).toContain("export interface Task");
    expect(generated).toContain('export const listTasksPath = { method: "GET", path: "/api/v1/tasks" } as const;');
    expect(generated).toContain("export type ListTasksResponse = Task[];");
  });

  it("codegen escapes endpoint paths, preserves object properties, and keeps output stable", () => {
    const document = {
      paths: {
        "/api/v1/users/{user-id}": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        "display-name": { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/api/v1/users/{user_id}": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      allOf: [
                        {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                          },
                        },
                      ],
                      properties: {
                        "display-name": { type: "string" },
                      },
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
          Zebra: {
            type: "object",
            properties: {
              zebra: { type: "string" },
            },
          },
          Alpha: {
            type: "object",
            properties: {
              alpha: { type: "string" },
            },
          },
        },
      },
    } as const;

    const generated = generateBindingsFromOpenApi(document);

    expect(generated).toContain('path: "/api/v1/users/{user-id}"');
    expect(generated).toContain('"display-name"?: string;');
    expect(generated).toMatch(/export type GetApiV1UsersUserIdResponse[A-Za-z0-9]* = \{\n  "display-name"\?: string;\n\} & \{\n  id\?: string;\n\}/);
    expect(generated.indexOf("export interface Alpha")).toBeLessThan(generated.indexOf("export interface Zebra"));
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
