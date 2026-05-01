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
  // Issue #1938 P2: path.includes uses substring matching - /api/v1/tasks incorrectly matches /api/v1/tasks-archive.
  // Use proper prefix matching with trailing slash to avoid false positives.
  const normalized = path.endsWith("/") ? path : path + "/";
  if (normalized.includes("/dashboard/")) {
    return defaultMockApiShape.dashboard;
  }
  if (normalized.includes("/tasks/")) {
    return defaultMockApiShape.tasks;
  }
  if (normalized.includes("/workflows/")) {
    return defaultMockApiShape.workflows;
  }
  return {
    ok: true,
    path,
  };
}
