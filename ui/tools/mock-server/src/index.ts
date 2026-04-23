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
