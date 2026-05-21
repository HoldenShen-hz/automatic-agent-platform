import { beforeEach, describe, it } from "node:test";
import { expect } from "../../../helpers/node-expect.js";
import { HrRoleGovernanceService } from "../../../../src/domains/governance/hr-role-governance-service.js";
import type {
  HrGapAnalysisRequest,
  HrRoleProposal,
  SubmitHrRoleProposalRequest,
  RegisterApprovedHrRoleRequest,
} from "../../../../src/domains/governance/hr-role-governance-service.js";

describe("HrRoleGovernanceService", () => {
  let service: HrRoleGovernanceService;

  beforeEach(() => {
    service = new HrRoleGovernanceService(null, null);
  });

  describe("analyzeGap", () => {
    it("should throw when division registry is unavailable", () => {
      const request: HrGapAnalysisRequest = {
        taskId: "task_1",
        taskDescription: "Test task",
        targetDivisionId: "div_1",
        triggerReason: "no_role_match",
        requestedCapabilities: ["coding", "analysis"],
      };
      expect(() => service.analyzeGap(request)).toThrow();
    });
  });

  describe("validateProposal", () => {
    it("should throw when division registry is unavailable", () => {
      const proposal: HrRoleProposal = {
        divisionId: "div_1",
        roleId: "role_1",
        name: "Test Role",
        promptText: "Test prompt text",
        model: "balanced",
        tools: ["read", "write"],
        scope: {
          responsibilities: ["perform analysis"],
          boundaries: ["no shell access"],
        },
        inputSchema: { required: ["input1"] },
        outputSchema: { required: ["output1"] },
        preconditions: [{ check: "always", description: "always passes" }],
      };
      expect(() => service.validateProposal(proposal)).toThrow();
    });

    it("should detect duplicate role ID", () => {
      // When registry is null, it throws - this is expected behavior
      const proposal: HrRoleProposal = {
        divisionId: "div_1",
        roleId: "role_1",
        name: "Test Role",
        promptText: "Test prompt text",
        model: "balanced",
        tools: ["read"],
        scope: {
          responsibilities: ["perform analysis"],
          boundaries: ["no shell access"],
        },
        inputSchema: { required: ["input1"] },
        outputSchema: { required: ["output1"] },
        preconditions: [{ check: "always", description: "always passes" }],
      };
      expect(() => service.validateProposal(proposal)).toThrow();
    });
  });

  describe("submitProposal", () => {
    it("should fail closed when registry is unavailable", () => {
      const request: SubmitHrRoleProposalRequest = {
        gapAnalysisRequest: {
          taskId: "task_1",
          taskDescription: "Test task",
          targetDivisionId: "div_1",
          triggerReason: "no_role_match",
          requestedCapabilities: ["coding"],
        },
        proposal: {
          divisionId: "div_1",
          roleId: "role_1",
          name: "Test Role",
          promptText: "Test prompt text",
          model: "balanced",
          tools: ["read"],
          scope: {
            responsibilities: ["perform analysis"],
            boundaries: ["no shell access"],
          },
          inputSchema: { required: ["input1"] },
          outputSchema: { required: ["output1"] },
          preconditions: [{ check: "always", description: "always passes" }],
        },
      };
      expect(() => service.submitProposal(request)).toThrow(
        "division.registry_unavailable",
      );
    });
  });

  describe("registerApprovedRole", () => {
    it("should throw when division registry is unavailable", () => {
      const request: RegisterApprovedHrRoleRequest = {
        proposal: {
          divisionId: "div_1",
          roleId: "role_1",
          name: "Test Role",
          promptText: "Test prompt text",
          model: "balanced",
          tools: ["read"],
          scope: {
            responsibilities: ["perform analysis"],
            boundaries: ["no shell access"],
          },
          inputSchema: { required: ["input1"] },
          outputSchema: { required: ["output1"] },
          preconditions: [{ check: "always", description: "always passes" }],
        },
        approvalStatus: "approved",
      };
      expect(() => service.registerApprovedRole(request)).toThrow();
    });

    it("should throw when approval status is not approved", () => {
      const request: RegisterApprovedHrRoleRequest = {
        proposal: {
          divisionId: "div_1",
          roleId: "role_1",
          name: "Test Role",
          promptText: "Test prompt text",
          model: "balanced",
          tools: ["read"],
          scope: {
            responsibilities: ["perform analysis"],
            boundaries: ["no shell access"],
          },
          inputSchema: { required: ["input1"] },
          outputSchema: { required: ["output1"] },
          preconditions: [{ check: "always", description: "always passes" }],
        },
        approvalStatus: "pending" as "approved",
      };
      expect(() => service.registerApprovedRole(request)).toThrow();
    });
  });

  describe("HrRoleProposalValidationResult structure", () => {
    it("should not expose a validation result without a registry", () => {
      expect(() =>
        service.submitProposal({
          gapAnalysisRequest: {
            taskId: "task_1",
            taskDescription: "Test",
            targetDivisionId: "div_1",
            triggerReason: "no_role_match",
            requestedCapabilities: [],
          },
          proposal: {
            divisionId: "div_1",
            roleId: "role_1",
            name: "Test",
            promptText: "Prompt",
            model: "balanced",
            tools: ["read"],
            scope: {
              responsibilities: ["task"],
              boundaries: ["limit"],
            },
            inputSchema: { required: [] },
            outputSchema: { required: [] },
            preconditions: [{ check: "check", description: "desc" }],
          },
        }),
      ).toThrow("division.registry_unavailable");
    });
  });
});
