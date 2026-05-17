import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { defaultMockApiShape } from "@aa/shared-api-client";

export function createMockServerSnapshot() {
  return defaultMockApiShape;
}

export function describePlannedEndpoint(id: string) {
  return {
    id,
    enabled: false,
    reason: "planned-endpoint-seam",
  };
}

export function resolveMockRequest(path: string) {
  const requestUrl = new URL(path, "http://mock.local");
  const pathname = requestUrl.pathname;

  if (pathname === "/api/v1/version") {
    return {
      accepted: true,
      apiVersion: "v1",
      platformVersion: "0.1.0",
      contractVersion: "1.0",
      minServerVersion: "1.0",
      supportedVersions: ["1.0"],
    };
  }
  if (pathname === "/api/v1/dashboard/snapshot") {
    return defaultMockApiShape.dashboard;
  }
  if (pathname === "/api/v1/tasks") {
    return defaultMockApiShape.tasks;
  }
  if (pathname === "/api/v1/workflows") {
    return defaultMockApiShape.workflows;
  }
  if (pathname === "/api/v1/approvals") {
    return defaultMockApiShape.approvals;
  }
  return {
    ok: true,
    path: pathname,
  };
}

export interface MockHttpServer {
  readonly server: Server;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function resolveRequestPath(request: IncomingMessage): string {
  return request.url ?? "/";
}

export function createMockRequestHandler() {
  return (request: IncomingMessage, response: ServerResponse) => {
    const path = resolveRequestPath(request);
    if (path === "/healthz") {
      writeJson(response, 200, { ok: true });
      return;
    }
    if (path.startsWith("/api/")) {
      writeJson(response, 200, resolveMockRequest(path));
      return;
    }
    writeJson(response, 404, { ok: false, path, reason: "not_found" });
  };
}

export async function createMockHttpServer(port = 0): Promise<MockHttpServer> {
  const server = createServer(createMockRequestHandler());

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const resolvedPort = typeof address === "object" && address != null ? address.port : port;
  return {
    server,
    port: resolvedPort,
    url: `http://127.0.0.1:${resolvedPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error != null) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
