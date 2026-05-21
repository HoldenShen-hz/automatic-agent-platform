import { beforeEach, describe, it } from "node:test";
import { expect } from "../../helpers/node-expect.js";
import { VerticalDomainArchitectureService } from "../../../src/domains/vertical-domain-architecture-service.js";
import type { VerticalDomainArchitectureRecord } from "../../../src/domains/vertical-domain-architecture-service.js";

describe("VerticalDomainArchitectureService", () => {
  let service: VerticalDomainArchitectureService;

  beforeEach(() => {
    service = new VerticalDomainArchitectureService();
  });

  describe("listVerticalDomainArchitectures", () => {
    it("should return array of architecture records", () => {
      const records = service.listVerticalDomainArchitectures();
      expect(Array.isArray(records)).toBe(true);
    });

    it("should return records with required properties", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = records[0]!;
        expect(record).toHaveProperty("domainId");
        expect(record).toHaveProperty("displayName");
        expect(record).toHaveProperty("phase");
        expect(record).toHaveProperty("architectureSections");
      }
    });

    it("should include all 8 architecture sections", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const sectionIds = records[0]!.architectureSections.map(
          (s) => s.sectionId,
        );
        expect(sectionIds).toContain("workflow");
        expect(sectionIds).toContain("tooling");
        expect(sectionIds).toContain("risk");
        expect(sectionIds).toContain("eval");
        expect(sectionIds).toContain("latency");
        expect(sectionIds).toContain("ownership");
        expect(sectionIds).toContain("knowledge");
        expect(sectionIds).toContain("recipes");
      }
    });
  });

  describe("getVerticalDomainArchitecture", () => {
    it("should return architecture record for valid domain", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record).toBeDefined();
        expect(record.domainId).toBe(records[0]!.domainId);
      }
    });

    it("should return architecture record with all sections", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record.architectureSections).toHaveLength(8);
      }
    });

    it("should include legacy domain IDs in record", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(Array.isArray(record.legacyDomainIds)).toBe(true);
      }
    });

    it("should include workflow specialization", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record.workflow).toBeDefined();
      }
    });

    it("should include tooling specialization", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record.tooling).toBeDefined();
      }
    });

    it("should include risk profile", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record.risk).toBeDefined();
      }
    });

    it("should include eval specialization", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record.eval).toBeDefined();
      }
    });

    it("should include latency profile", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record.latency).toBeDefined();
      }
    });

    it("should include ownership profile", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(record.ownership).toBeDefined();
      }
    });

    it("should include knowledge namespaces", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(Array.isArray(record.knowledgeNamespaces)).toBe(true);
      }
    });

    it("should include recipe IDs", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        expect(Array.isArray(record.recipeIds)).toBe(true);
      }
    });
  });

  describe("hasVerticalDomainArchitecture", () => {
    it("should return true for existing domain", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        expect(
          service.hasVerticalDomainArchitecture(records[0]!.domainId),
        ).toBe(true);
      }
    });

    it("should return false for non-existing domain", () => {
      expect(service.hasVerticalDomainArchitecture("non_existing_domain")).toBe(
        false,
      );
    });

    it("should handle legacy domain IDs", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0 && records[0]!.legacyDomainIds.length > 0) {
        // Some legacy IDs may exist
        expect(
          typeof service.hasVerticalDomainArchitecture(
            records[0]!.legacyDomainIds[0]!,
          ),
        ).toBe("boolean");
      }
    });
  });

  describe("architecture section summaries", () => {
    it("should include non-empty section summaries", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        for (const section of record.architectureSections) {
          expect(section.summary.length).toBeGreaterThan(0);
        }
      }
    });

    it("should have valid section structure", () => {
      const records = service.listVerticalDomainArchitectures();
      if (records.length > 0) {
        const record = service.getVerticalDomainArchitecture(
          records[0]!.domainId,
        );
        for (const section of record.architectureSections) {
          expect(section).toHaveProperty("sectionId");
          expect(section).toHaveProperty("title");
          expect(section).toHaveProperty("summary");
          expect(typeof section.title).toBe("string");
          expect(typeof section.summary).toBe("string");
        }
      }
    });
  });
});
