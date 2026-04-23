import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createNoOpIncidentFacadeService, createNoOpIncidentFacadeService as createSvc } from "../../../../src/platform/interface/api/facade-interfaces.js";

describe("api/facade-interfaces", () => {
  describe("createNoOpIncidentFacadeService", () => {
    it("should return an IncidentFacadeService", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.ok(svc != null);
    });

    it("should listIncidents return empty array", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.deepEqual(svc.listIncidents(), []);
    });

    it("should listIncidents with limit return empty array", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.deepEqual(svc.listIncidents(10), []);
    });

    it("should getIncident return null", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.equal(svc.getIncident("incident-1"), null);
    });

    it("should openIncident throw error", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.throws(() => svc.openIncident({ severity: "high", title: "Test" }), /not configured/);
    });

    it("should acknowledge throw error", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.throws(() => svc.acknowledge("incident-1", "operator-1"), /not configured/);
    });

    it("should startMitigation throw error", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.throws(() => svc.startMitigation("incident-1"), /not configured/);
    });

    it("should resolve throw error", () => {
      const svc = createNoOpIncidentFacadeService();
      assert.throws(() => svc.resolve("incident-1"), /not configured/);
    });
  });

  describe("IncidentCase type", () => {
    it("should allow creating incident case object", () => {
      const incident = {
        incidentId: "inc-123",
        severity: "critical" as const,
        status: "open" as const,
        title: "System down",
        linkedEvidenceRefs: ["ref-1", "ref-2"],
        owner: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        resolvedAt: null,
      };
      assert.equal(incident.incidentId, "inc-123");
      assert.equal(incident.severity, "critical");
    });
  });

  describe("CoordinatorSelectionInput", () => {
    it("should allow optional fields", () => {
      const input = { tenantId: "tenant-1" };
      assert.equal(input.tenantId, "tenant-1");
    });
  });

  describe("ArtifactRecord", () => {
    it("should allow creating artifact record", () => {
      const artifact = {
        artifactId: "art-1",
        name: "release.zip",
        mimeType: "application/zip",
        sizeBytes: 1024,
        checksum: "abc123",
        storageRef: "s3://bucket/path",
        createdAt: "2024-01-01T00:00:00Z",
      };
      assert.equal(artifact.name, "release.zip");
    });
  });
});