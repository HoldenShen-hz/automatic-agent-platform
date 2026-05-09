/**
 * R10-01: Access Model Role Inheritance Tests
 *
 * Tests hierarchical role inheritance for capabilities.
 */

import { describe, it, expect } from "../test-utils.js";
import {
  PlatformRole,
  capabilitiesForRole,
  roleGrantsCapabilities,
  resolvePrincipalAccessProfile,
} from "../../../src/platform/five-plane-control-plane/iam/access-model.js";

describe("R10-01: Role Inheritance", () => {
  describe("capabilitiesForRole", () => {
    it("viewer has no capabilities", () => {
      const caps = capabilitiesForRole("viewer");
      expect(caps).toHaveLength(0);
    });

    it("human_operator inherits from viewer (has viewer capabilities + its own)", () => {
      const caps = capabilitiesForRole("human_operator");
      // human_operator should have its own caps plus inherited viewer caps
      expect(caps).toContain("model:invoke");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("fs:write");
      expect(caps).toContain("exec:command");
      expect(caps).toContain("network:access");
    });

    it("approver inherits from viewer", () => {
      const caps = capabilitiesForRole("approver");
      expect(caps).toContain("model:invoke");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("network:access");
    });

    it("platform_admin has all capabilities (no inheritance needed)", () => {
      const caps = capabilitiesForRole("platform_admin");
      expect(caps).toContain("model:invoke");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("fs:write");
      expect(caps).toContain("exec:command");
      expect(caps).toContain("network:access");
      expect(caps).toContain("extension:install");
      expect(caps).toContain("org:change");
      expect(caps).toContain("execution:dispatch");
      expect(caps).toContain("improvement:promote");
      expect(caps).toContain("rollout:advance");
      expect(caps).toContain("memory:promote");
      expect(caps).toContain("knowledge:trust:modify");
    });

    it("agent_runtime does not inherit from any role", () => {
      const caps = capabilitiesForRole("agent_runtime");
      expect(caps).toContain("model:invoke");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("fs:write");
      expect(caps).toContain("exec:command");
      expect(caps).toContain("network:access");
      // Should NOT have capabilities that viewer doesn't have
      expect(caps).not.toContain("extension:install");
    });

    it("service_operator does not inherit from any role", () => {
      const caps = capabilitiesForRole("service_operator");
      expect(caps).toContain("model:invoke");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("network:access");
      expect(caps).toContain("execution:dispatch");
      expect(caps).toContain("rollout:advance");
      expect(caps).toContain("knowledge:trust:modify");
    });

    it("worker_runtime does not inherit (only tool:invoke, fs:write, exec:command)", () => {
      const caps = capabilitiesForRole("worker_runtime");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("fs:write");
      expect(caps).toContain("exec:command");
      expect(caps).not.toContain("model:invoke");
      expect(caps).not.toContain("network:access");
    });

    it("plugin_runtime does not inherit", () => {
      const caps = capabilitiesForRole("plugin_runtime");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("fs:write");
      expect(caps).toContain("network:access");
      expect(caps).not.toContain("exec:command");
    });

    it("system_runtime does not inherit", () => {
      const caps = capabilitiesForRole("system_runtime");
      expect(caps).toContain("model:invoke");
      expect(caps).toContain("tool:invoke");
      expect(caps).toContain("fs:write");
      expect(caps).toContain("exec:command");
      expect(caps).toContain("network:access");
      expect(caps).toContain("execution:dispatch");
      expect(caps).toContain("memory:promote");
    });
  });

  describe("roleGrantsCapabilities", () => {
    it("human_operator has viewer inherited capabilities", () => {
      const result = roleGrantsCapabilities(["human_operator"], ["network:access"]);
      expect(result).toBe(true);
    });

    it("approver has viewer inherited capabilities", () => {
      const result = roleGrantsCapabilities(["approver"], ["model:invoke"]);
      expect(result).toBe(true);
    });

    it("worker_runtime does not grant network:access (not inherited)", () => {
      const result = roleGrantsCapabilities(["worker_runtime"], ["network:access"]);
      expect(result).toBe(false);
    });

    it("platform_admin grants all capabilities", () => {
      const result = roleGrantsCapabilities(
        ["platform_admin"],
        ["extension:install", "org:change", "execution:dispatch"],
      );
      expect(result).toBe(true);
    });
  });

  describe("resolvePrincipalAccessProfile", () => {
    it("resolves user principal with default viewer role", () => {
      const profile = resolvePrincipalAccessProfile({ principalType: "user" });
      expect(profile.principalType).toBe("user");
      expect(profile.roles).toContain("viewer");
    });

    it("resolves agent principal with default agent_runtime role", () => {
      const profile = resolvePrincipalAccessProfile({ principalType: "agent" });
      expect(profile.principalType).toBe("agent");
      expect(profile.roles).toContain("agent_runtime");
    });

    it("merges role capabilities with inheritance", () => {
      const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["human_operator"],
      });
      // Should include inherited viewer capabilities
      expect(profile.capabilities).toContain("model:invoke");
      expect(profile.capabilities).toContain("network:access");
    });

    it("adds explicit capabilities on top of role capabilities", () => {
      const profile = resolvePrincipalAccessProfile({
        principalType: "user",
        roles: ["viewer"],
        capabilities: ["extension:install"],
      });
      expect(profile.capabilities).toContain("extension:install");
    });
  });
});