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
  if (path.includes("dashboard")) {
    return defaultMockApiShape.dashboard;
  }
  if (path.includes("tasks")) {
    return defaultMockApiShape.tasks;
  }
  if (path.includes("workflows")) {
    return defaultMockApiShape.workflows;
  }
  return {
    ok: true,
    path,
  };
}
