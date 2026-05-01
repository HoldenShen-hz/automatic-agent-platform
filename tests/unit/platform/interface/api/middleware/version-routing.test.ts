import { describe, it } from "node:test";
import assert, { strictEqual, deepStrictEqual, ok, fail } from "node:assert";
import {
  VersionRoutingMiddleware,
  DEFAULT_VERSION_ROUTING_CONFIG,
  globalVersionRoutingMiddleware,
  type VersionRoutingConfig,
} from "../../../../../../src/platform/interface/api/middleware/version-routing.js";

describe("VersionRoutingMiddleware", () => {
  describe("constructor", () => {
    it("should use default config when no overrides provided", () => {
      const middleware = new VersionRoutingMiddleware();
      strictEqual(middleware.getSupportedVersions().length, 2);
    });

    it("should merge custom config with defaults", () => {
      const middleware = new VersionRoutingMiddleware({
        supportedVersions: ["2026-05-01", "2026-04-01", "2026-03-01"],
      });
      strictEqual(middleware.getSupportedVersions().length, 3);
    });
  });

  describe("parseAcceptVersion", () => {
    it("should return default version for null input", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.parseAcceptVersion(null);
      deepStrictEqual(versions, ["2026-04-01"]);
    });

    it("should return default version for empty string", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.parseAcceptVersion("");
      deepStrictEqual(versions, ["2026-04-01"]);
    });

    it("should return default version for whitespace only", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.parseAcceptVersion("   ");
      deepStrictEqual(versions, ["2026-04-01"]);
    });

    it("should parse single version", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.parseAcceptVersion("2026-04-01");
      deepStrictEqual(versions, ["2026-04-01"]);
    });

    it("should parse comma-separated versions", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.parseAcceptVersion("2026-04-01,2026-01-01");
      deepStrictEqual(versions, ["2026-04-01", "2026-01-01"]);
    });

    it("should trim whitespace from versions", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.parseAcceptVersion("  2026-04-01  ,  2026-01-01  ");
      deepStrictEqual(versions, ["2026-04-01", "2026-01-01"]);
    });

    it("should filter empty entries", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.parseAcceptVersion("2026-04-01,,2026-01-01");
      deepStrictEqual(versions, ["2026-04-01", "2026-01-01"]);
    });
  });

  describe("selectVersion", () => {
    it("should return default version for empty input", () => {
      const middleware = new VersionRoutingMiddleware();
      const decision = middleware.selectVersion([]);
      strictEqual(decision.acceptable, true);
      strictEqual(decision.version, "2026-04-01");
      strictEqual(decision.reasonCode, "version.default");
    });

    it("should accept exact matching version", () => {
      const middleware = new VersionRoutingMiddleware();
      const decision = middleware.selectVersion(["2026-04-01"]);
      strictEqual(decision.acceptable, true);
      strictEqual(decision.version, "2026-04-01");
      strictEqual(decision.reasonCode, "version.acceptable");
    });

    it("should accept version with q-value", () => {
      const middleware = new VersionRoutingMiddleware();
      const decision = middleware.selectVersion(["2026-04-01; q=0.9"]);
      strictEqual(decision.acceptable, true);
      strictEqual(decision.version, "2026-04-01");
    });

    it("should reject version below minimum", () => {
      const middleware = new VersionRoutingMiddleware();
      const decision = middleware.selectVersion(["2025-01-01"]);
      strictEqual(decision.acceptable, false);
      strictEqual(decision.statusCode, 400);
      strictEqual(decision.reasonCode, "version.below_minimum");
    });

    it("should use fallback version when no match", () => {
      const middleware = new VersionRoutingMiddleware();
      const decision = middleware.selectVersion(["2025-12-01"]);
      strictEqual(decision.acceptable, true);
      strictEqual(decision.reasonCode, "version.fallback");
    });

    it("should include warning for unsupported versions", () => {
      const middleware = new VersionRoutingMiddleware();
      const decision = middleware.selectVersion(["2025-12-01"]);
      ok(decision.warnings.length > 0);
      ok(decision.warnings.some((w) => w.includes("version_not_supported")));
    });
  });

  describe("isVersionSupported", () => {
    it("should return true for supported version", () => {
      const middleware = new VersionRoutingMiddleware();
      strictEqual(middleware.isVersionSupported("2026-04-01"), true);
    });

    it("should return false for unsupported version", () => {
      const middleware = new VersionRoutingMiddleware();
      strictEqual(middleware.isVersionSupported("2020-01-01"), false);
    });
  });

  describe("getSupportedVersions", () => {
    it("should return configured versions", () => {
      const middleware = new VersionRoutingMiddleware();
      const versions = middleware.getSupportedVersions();
      ok(versions.includes("2026-04-01"));
      ok(versions.includes("2026-01-01"));
    });
  });

  describe("version comparison", () => {
    it("should compare date-based versions", () => {
      const middleware = new VersionRoutingMiddleware();

      const decision1 = middleware.selectVersion(["2026-05-01"]);
      const decision2 = middleware.selectVersion(["2026-03-01"]);

      ok(decision1.version >= "2026-01-01");
      ok(decision2.version >= "2026-01-01");
    });
  });
});

describe("DEFAULT_VERSION_ROUTING_CONFIG", () => {
  it("should have standard versions", () => {
    strictEqual(DEFAULT_VERSION_ROUTING_CONFIG.supportedVersions.length, 2);
    strictEqual(DEFAULT_VERSION_ROUTING_CONFIG.defaultVersion, "2026-04-01");
    strictEqual(DEFAULT_VERSION_ROUTING_CONFIG.minimumVersion, "2026-01-01");
  });
});

describe("globalVersionRoutingMiddleware", () => {
  it("should be an instance", () => {
    ok(globalVersionRoutingMiddleware instanceof VersionRoutingMiddleware);
  });

  it("should have default supported versions", () => {
    strictEqual(globalVersionRoutingMiddleware.isVersionSupported("2026-04-01"), true);
  });
});
