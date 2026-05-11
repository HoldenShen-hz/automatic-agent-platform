import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateBindingsFromOpenApi, generateEndpointBindingModule } from "@aa/codegen";
import { createPlaywrightScenarioDefinitions, createScenarioChecklist } from "@aa/e2e";
import { createMockRequestHandler, describePlannedEndpoint, resolveMockRequest } from "@aa/mock-server";

describe("ui tooling baselines", () => {
  it("exposes runnable codegen, mock-server and e2e helpers", () => {
    const source = generateEndpointBindingModule([
      { id: "tasks", path: "/api/v1/tasks" },
      { id: "dashboard", path: "/api/v1/dashboard/snapshot" },
    ]);
    const openApiSource = generateBindingsFromOpenApi({
      components: {
        schemas: {
          TaskDto: {
            type: "object",
            required: ["id", "title"],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              tags: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
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
                      items: { $ref: "#/components/schemas/TaskDto" },
                    },
                  },
                },
              },
            },
          },
          post: {
            operationId: "createTask",
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TaskDto" },
                },
              },
            },
            responses: {
              "201": {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/TaskDto" },
                  },
                },
              },
            },
          },
        },
      },
    });
    const playwrightDefinitions = createPlaywrightScenarioDefinitions("http://127.0.0.1:4173");

    expect(source).toContain('export const tasksPath = "/api/v1/tasks";');
    expect(openApiSource).toContain('export const listTasksPath = { method: "GET", path: "/api/v1/tasks" } as const;');
    expect(openApiSource).toContain("export interface TaskDto");
    expect(openApiSource).toContain("export type ListTasksResponse = TaskDto[];");
    expect(openApiSource).toContain("export type CreateTaskRequestBody = TaskDto;");
    expect(openApiSource).toContain("export type CreateTaskResponse = TaskDto;");
    expect(resolveMockRequest("/api/v1/tasks")).toBeDefined();
    expect(describePlannedEndpoint("analytics").enabled).toBe(false);
    expect(createScenarioChecklist()).toHaveLength(7);
    expect(playwrightDefinitions[0]?.url.startsWith("http://127.0.0.1:4173/")).toBe(true);
  });

  it("exposes an http request handler for health and api routes", async () => {
    const handler = createMockRequestHandler();
    const response = {
      statusCode: 0,
      headers: new Map<string, string>(),
      body: "",
      setHeader(name: string, value: string) {
        this.headers.set(name, value);
      },
      end(payload: string) {
        this.body = payload;
      },
    };

    handler({ url: "/healthz" } as never, response as never);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });

    handler({ url: "/api/v1/tasks" } as never, response as never);
    expect(response.statusCode).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("ships a storybook baseline", () => {
    const root = process.cwd();
    expect(existsSync(join(root, ".storybook/main.ts"))).toBe(true);
    expect(existsSync(join(root, ".storybook/preview.ts"))).toBe(true);
  });

  it("defines lint, coverage and bundle/perf quality gates", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };

    expect(packageJson.scripts.lint).toContain("eslint");
    expect(packageJson.scripts["test:coverage"]).toContain("--coverage");
    expect(packageJson.scripts["test:visual"]).toContain("visual-regression.spec.ts");
    expect(packageJson.scripts["bundle:analyze"]).toContain("bundle-analysis");
    expect(packageJson.scripts["perf:budget"]).toContain("perf-budget");
    expect(existsSync(join(root, "eslint.config.js"))).toBe(true);
    expect(existsSync(join(root, "scripts/run-task-with-stamp.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/bundle-analysis.mjs"))).toBe(true);
    expect(existsSync(join(root, "scripts/perf-budget.mjs"))).toBe(true);
    expect(existsSync(join(root, "turbo.json"))).toBe(true);
    expect(existsSync(join(root, "../.github/workflows/ui-quality.yml"))).toBe(true);
  });
});
