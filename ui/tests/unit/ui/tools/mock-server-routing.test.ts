import { describe, expect, it } from "vitest";

import { resolveMockRequest } from "../../../../tools/mock-server/src/index.js";

describe("resolveMockRequest", () => {
  it("matches exact task routes without leaking into similarly prefixed paths", () => {
    const tasks = resolveMockRequest("/api/v1/tasks");
    const archived = resolveMockRequest("/api/v1/tasks-archive");

    expect(tasks).not.toEqual(archived);
    expect(archived).toEqual({
      ok: true,
      path: "/api/v1/tasks-archive",
    });
  });

  it("ignores query strings when resolving canonical routes", () => {
    const result = resolveMockRequest("/api/v1/meta/contract-version?verbose=true");
    expect(result).toEqual({
      accepted: true,
      apiVersion: "v1",
      platformVersion: "0.1.0",
      contractVersion: "1.0",
      minServerVersion: "1.0",
      supportedVersions: ["1.0"],
    });
  });
});
