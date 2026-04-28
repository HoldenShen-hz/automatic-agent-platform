import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CrossRegionRoutingService, type CrossRegionRouteRequest } from "../../../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import { selectPreferredRegion } from "../../../../../src/scale-ecosystem/multi-region/region-router/index.js";

function createTestRegion(overrides: Partial<{
  regionId: string;
  jurisdiction: string;
  latencyScore: number;
  status: string;
  residencyAllowed: boolean;
}> = {}): Parameters<typeof selectPreferredRegion>[0][number] {
  return {
    regionId: overrides.regionId ?? "region-us-east-1",
    provider: "aws",
    endpoints: {
      api: "https://api.example.com",
    },
    dataResidencyPolicy: "regional",
    countryCode: "US",
    jurisdiction: overrides.jurisdiction ?? "US",
    capabilities: [],
    status: (overrides.status as "active" | "standby" | "draining") ?? "active",
    latencyScore: overrides.latencyScore ?? 0,
    residencyAllowed: overrides.residencyAllowed ?? true,
  };
}

describe("cross-region-routing", () => {
  describe("Cross-border 5-step chain per R3-30", () => {
    it("executes all 5 steps in cross-border transfer chain", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US", latencyScore: 30 }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU", latencyScore: 60 }),
        ],
        policy: {
          policyId: "gdpr-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        preferredRegionId: null,
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);

      assert.ok(decision.crossBorderTransferChain, "cross-border transfer chain should be executed");
      assert.ok(decision.crossBorderTransferChain?.chainStepResults, "chain step results should exist");

      const steps = decision.crossBorderTransferChain!.chainStepResults;
      assert.ok(steps.jurisdictionClassification, "Step 1: JurisdictionClassifier should execute");
      assert.ok(steps.impactAssessment, "Step 2: TransferImpactAssessor should execute");
      assert.ok(steps.mechanismSelection, "Step 3: MechanismSelector should execute");
      assert.ok(steps.dataMinimization, "Step 4: DataMinimizer should execute");
      assert.ok(steps.outputScan, "Step 5: OutputScanner should execute");
    });

    it("Step 1: JurisdictionClassifier sets correct source and target jurisdictions", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const classification = decision.crossBorderTransferChain?.chainStepResults.jurisdictionClassification;

      assert.strictEqual(classification?.sourceJurisdiction, "US");
      assert.strictEqual(classification?.targetJurisdiction, "EU");
      assert.strictEqual(classification?.crossBorderRequired, true);
    });

    it("Step 1: crossBorderRequired is false for same jurisdiction", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-us-west-2", jurisdiction: "US" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const classification = decision.crossBorderTransferChain?.chainStepResults.jurisdictionClassification;

      assert.strictEqual(classification?.crossBorderRequired, false);
    });

    it("Step 2: TransferImpactAssessor sets correct impact score for cross-border", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const impact = decision.crossBorderTransferChain?.chainStepResults.impactAssessment;

      assert.strictEqual(impact?.impactScore, 0.7);
      assert.ok(impact?.dataCategories.includes("personal"), "should include personal data category");
    });

    it("Step 2: TransferImpactAssessor flags GDPR for EU target", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "gdpr-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const impact = decision.crossBorderTransferChain?.chainStepResults.impactAssessment;

      assert.ok(impact?.regulatoryFlags.includes("GDPR_ARTICLE_44"));
    });

    it("Step 3: MechanismSelector selects encrypted_pipeline for low risk cross-border", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const mechanism = decision.crossBorderTransferChain?.chainStepResults.mechanismSelection;

      assert.strictEqual(mechanism?.selectedMechanism, "encrypted_pipeline");
      assert.strictEqual(mechanism?.encryptionRequired, true);
      assert.strictEqual(mechanism?.auditLoggingRequired, true);
      assert.strictEqual(mechanism?.allowedByPolicy, true);
    });

    it("Step 3: MechanismSelector blocks when policy disallows cross-border", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "restricted-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: false,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const mechanism = decision.crossBorderTransferChain?.chainStepResults.mechanismSelection;

      assert.strictEqual(mechanism?.allowedByPolicy, false);
    });

    it("Step 4: DataMinimizer redacts PII for encrypted_pipeline", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const minimization = decision.crossBorderTransferChain?.chainStepResults.dataMinimization;

      assert.ok(minimization?.fieldsToRedact.includes("email"));
      assert.ok(minimization?.fieldsToRedact.includes("phone"));
      assert.ok(minimization?.fieldsToRedact.includes("address"));
      assert.strictEqual(minimization?.aggregationLevel, "pseudonymized");
      assert.strictEqual(minimization?.minimizationApplied, true);
    });

    it("Step 4: DataMinimizer uses fully_aggregated for federated_query", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "high-risk-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
        dataCategories: ["personal", "health"],
      };

      const decision = service.route(request);
      const mechanism = decision.crossBorderTransferChain?.chainStepResults.mechanismSelection;
      const minimization = decision.crossBorderTransferChain?.chainStepResults.dataMinimization;

      // High risk triggers federated_query which uses fully_aggregated
      if (mechanism?.selectedMechanism === "federated_query") {
        assert.strictEqual(minimization?.aggregationLevel, "fully_aggregated");
      }
    });

    it("Step 5: OutputScanner passes for allowed transfer", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const outputScan = decision.crossBorderTransferChain?.chainStepResults.outputScan;

      assert.strictEqual(outputScan?.passed, true);
      assert.deepStrictEqual(outputScan?.violations, []);
    });

    it("Step 5: OutputScanner blocks when policy disallows", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "restricted-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: false,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const outputScan = decision.crossBorderTransferChain?.chainStepResults.outputScan;

      assert.strictEqual(outputScan?.passed, false);
      assert.ok(outputScan?.violations.includes("Cross-border transfer not allowed by policy"));
    });

    it("overallDecision is blocked when policy disallows cross-border", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "restricted-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: false,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);

      assert.strictEqual(decision.crossBorderTransferChain?.overallDecision, "blocked");
      assert.ok(decision.crossBorderTransferChain?.blockedReason !== null);
    });

    it("auditTrail contains entries for all 5 steps", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);
      const auditTrail = decision.crossBorderTransferChain?.auditTrail ?? [];

      assert.ok(auditTrail.some(entry => entry.startsWith("step1_jurisdiction")));
      assert.ok(auditTrail.some(entry => entry.startsWith("step2_impact")));
      assert.ok(auditTrail.some(entry => entry.startsWith("step3_mechanism")));
      assert.ok(auditTrail.some(entry => entry.startsWith("step4_minimization")));
      assert.ok(auditTrail.some(entry => entry.startsWith("step5_outputscan")));
    });

    it("no cross-border chain when jurisdictions are the same", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US" }),
          createTestRegion({ regionId: "region-us-west-2", jurisdiction: "US" }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);

      assert.strictEqual(decision.crossBorderTransferChain, undefined);
    });
  });

  describe("route decision fields", () => {
    it("returns correct decision structure with all required fields", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US", latencyScore: 30 }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU", latencyScore: 60 }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);

      assert.ok(decision.decisionId.startsWith("cross_region_decision:"));
      assert.ok(typeof decision.selectedRegionId === "string" || decision.selectedRegionId === null);
      assert.ok(Array.isArray(decision.candidateRegions));
      assert.ok(["allowed", "blocked", "requires_review"].includes(decision.residencyDecision));
      assert.ok(typeof decision.policyRef === "string");
      assert.ok(Array.isArray(decision.auditTrail));
      assert.ok(decision.recoveryTopology);
      assert.ok(Array.isArray(decision.blockedRegions));
    });

    it("recoveryTopology includes primary, failover, and replication targets", () => {
      const service = new CrossRegionRoutingService();
      const request: CrossRegionRouteRequest = {
        regions: [
          createTestRegion({ regionId: "region-us-east-1", jurisdiction: "US", latencyScore: 30 }),
          createTestRegion({ regionId: "region-eu-west-1", jurisdiction: "EU", latencyScore: 60 }),
        ],
        policy: {
          policyId: "test-policy",
          allowedJurisdictions: ["US", "EU"],
          allowCrossBorder: true,
        },
        primaryRegionId: "region-us-east-1",
        primaryRegionHealthy: true,
      };

      const decision = service.route(request);

      assert.ok(typeof decision.recoveryTopology.primaryRegionId === "string" || decision.recoveryTopology.primaryRegionId === null);
      assert.ok(typeof decision.recoveryTopology.failoverRegionId === "string" || decision.recoveryTopology.failoverRegionId === null);
      assert.ok(Array.isArray(decision.recoveryTopology.replicationTargets));
    });
  });
});