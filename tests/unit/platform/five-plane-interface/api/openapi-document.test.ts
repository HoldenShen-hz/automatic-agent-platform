import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenApiDocument,
  listApiRoutes,
  type ApiRouteSpec,
} from "../../../../../src/platform/five-plane-interface/api/openapi-document.js";

describe("openapi-document", () => {
  describe("buildOpenApiDocument", () => {
    it("should return an OpenAPI 3.1 document", () => {
      const doc = buildOpenApiDocument();

      assert.strictEqual(doc.openapi, "3.1.0");
      assert.ok(doc.info);
      assert.strictEqual(doc.info.title, "Automatic Agent API");
      assert.strictEqual(doc.info.version, "0.1.0");
      assert.ok(doc.paths);
    });

    it("should include health endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/healthz"]);
      assert.ok(doc.paths["/health"]);
    });

    it("should include metrics endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/metrics"]);
      assert.ok(doc.paths["/v1/metrics"]);
      assert.ok(doc.paths["/prometheus"]);
    });

    it("should include OpenAPI JSON endpoint", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/openapi.json"]);
    });

    it("should include auth token endpoint", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/auth/token"]);
      const postSpec = doc.paths["/v1/auth/token"] as Record<string, unknown>;
      assert.strictEqual(postSpec.post?.summary, "Exchange API key for bearer token");
    });

    it("should include dashboard snapshot endpoint", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/dashboard/snapshot"]);
    });

    it("should include task endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/tasks"]);
      assert.ok(doc.paths["/v1/tasks/{taskId}"]);
      assert.ok(doc.paths["/v1/tasks/{taskId}/events"]);
      assert.ok(doc.paths["/v1/tasks/{taskId}/inspect"]);
    });

    it("should include workflow endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/workflows"]);
    });

    it("should include approval endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/approvals"]);
      assert.ok(doc.paths["/v1/approvals/{approvalId}/decision"]);
    });

    it("should include webhook endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/webhooks/{endpointId}/receive"]);
    });

    it("should include admin endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/admin/control-plane/load-balancing"]);
      assert.ok(doc.paths["/v1/admin/control-plane/load-balancing/select"]);
      assert.ok(doc.paths["/v1/admin/inventories/benchmarks"]);
      assert.ok(doc.paths["/v1/admin/inventories/projections"]);
      assert.ok(doc.paths["/v1/admin/inventories/deployments"]);
      assert.ok(doc.paths["/v1/admin/inventories/schema"]);
      assert.ok(doc.paths["/v1/admin/judges"]);
      assert.ok(doc.paths["/v1/admin/compliance/program-templates"]);
    });

    it("should include knowledge plane endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/knowledge/namespaces"]);
      assert.ok(doc.paths["/v1/knowledge/query"]);
      assert.ok(doc.paths["/v1/knowledge/graph"]);
      assert.ok(doc.paths["/v1/knowledge/semantic/inspect"]);
      assert.ok(doc.paths["/v1/knowledge/{namespace}/inspect"]);
    });

    it("should include domain and plugin endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/domains"]);
      assert.ok(doc.paths["/v1/domains/{domainId}"]);
      assert.ok(doc.paths["/v1/domains/{domainId}/plugins"]);
      assert.ok(doc.paths["/v1/plugins"]);
    });

    it("should include artifact endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/artifacts/publishes"]);
      assert.ok(doc.paths["/v1/artifacts/bundles/preview"]);
      assert.ok(doc.paths["/v1/artifacts/bundles/publish"]);
    });

    it("should include gateway endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/gateway/targets"]);
      assert.ok(doc.paths["/v1/gateway/targets/resolve"]);
      assert.ok(doc.paths["/v1/gateway/messages/send"]);
    });

    it("should include division endpoints", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/v1/divisions"]);
    });

    it("should include correct HTTP methods for each path", () => {
      const doc = buildOpenApiDocument();

      assert.ok(doc.paths["/healthz"]?.get);
      assert.ok(doc.paths["/v1/auth/token"]?.post);
      assert.ok(doc.paths["/v1/webhooks/{endpointId}/receive"]?.post);
      assert.ok(doc.paths["/v1/approvals/{approvalId}/decision"]?.post);
    });

    it("should include query parameter definitions for paginated endpoints", () => {
      const doc = buildOpenApiDocument();

      const tasksSpec = doc.paths["/v1/tasks"] as Record<string, unknown>;
      const params = tasksSpec.get?.parameters as Array<Record<string, unknown>> | undefined;

      assert.ok(params);
      assert.ok(params!.some((p) => p.name === "limit"));
      assert.ok(params!.some((p) => p.name === "cursor"));
    });

    it("should include 200 response definitions", () => {
      const doc = buildOpenApiDocument();

      const healthSpec = doc.paths["/healthz"] as Record<string, unknown>;
      assert.ok(healthSpec.get?.responses?.["200"]);
    });
  });

  describe("listApiRoutes", () => {
    it("should return an array of route specs", () => {
      const routes = listApiRoutes();

      assert.ok(Array.isArray(routes));
      assert.ok(routes.length > 0);
    });

    it("should return route specs with required fields", () => {
      const routes = listApiRoutes();

      for (const route of routes) {
        assert.ok(route.method);
        assert.ok(route.path);
        assert.ok(route.summary);
        assert.ok(Array.isArray(route.tags));
        assert.ok(route.tags.length > 0);
      }
    });

    it("should include only supported HTTP methods", () => {
      const routes = listApiRoutes();

      for (const route of routes) {
        assert.ok(
          ["GET", "POST", "PATCH", "DELETE"].includes(route.method),
          `Unexpected method: ${route.method}`,
        );
      }
    });

    it("should have valid path format", () => {
      const routes = listApiRoutes();

      for (const route of routes) {
        assert.ok(route.path.startsWith("/"), `Invalid path format: ${route.path}`);
      }
    });

    it("should have unique paths per method combination", () => {
      const routes = listApiRoutes();
      const seen = new Set<string>();

      for (const route of routes) {
        const key = `${route.method}:${route.path}`;
        assert.ok(!seen.has(key), `Duplicate route: ${key}`);
        seen.add(key);
      }
    });

    it("should include health routes", () => {
      const routes = listApiRoutes();

      const healthRoutes = routes.filter((r) => r.tags.includes("health"));
      assert.ok(healthRoutes.length >= 2);
      assert.ok(healthRoutes.some((r) => r.path === "/healthz"));
      assert.ok(healthRoutes.some((r) => r.path === "/health"));
    });

    it("should include auth routes", () => {
      const routes = listApiRoutes();

      const authRoutes = routes.filter((r) => r.tags.includes("auth"));
      assert.ok(authRoutes.length >= 1);
      assert.ok(authRoutes.some((r) => r.path === "/v1/auth/token"));
    });

    it("should include dashboard routes", () => {
      const routes = listApiRoutes();

      const dashboardRoutes = routes.filter((r) => r.tags.includes("dashboard"));
      assert.ok(dashboardRoutes.length >= 2);
      assert.ok(dashboardRoutes.some((r) => r.path === "/v1/dashboard/snapshot"));
    });

    it("should have all routes match buildOpenApiDocument paths", () => {
      const routes = listApiRoutes();
      const doc = buildOpenApiDocument();

      for (const route of routes) {
        const pathSpec = doc.paths[route.path] as Record<string, unknown> | undefined;
        assert.ok(
          pathSpec,
          `Route ${route.method} ${route.path} not found in OpenAPI document`,
        );
        const methodSpec = pathSpec[route.method.toLowerCase()];
        assert.ok(methodSpec, `Method ${route.method} not found for path ${route.path}`);
      }
    });

    it("should return copy of routes array (immutability)", () => {
      const routes1 = listApiRoutes();
      const routes2 = listApiRoutes();

      // Verify they are different array instances
      assert.notStrictEqual(routes1, routes2);
      // But contain same content
      assert.strictEqual(routes1.length, routes2.length);
    });

    it("should include query parameter specs for paginated routes", () => {
      const routes = listApiRoutes();

      const paginatedRoutes = routes.filter((r) => r.queryParameters != null);
      assert.ok(paginatedRoutes.length >= 2);

      const tasksRoute = paginatedRoutes.find((r) => r.path === "/v1/tasks");
      assert.ok(tasksRoute);
      assert.ok(tasksRoute.queryParameters!.some((p) => p.name === "limit"));
      assert.ok(tasksRoute.queryParameters!.some((p) => p.name === "cursor"));
    });
  });
});
