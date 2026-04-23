export const COMPLIANCE_CAPABILITY_BASELINES = Object.freeze([
    {
        capabilityId: "crypto-shredding",
        entryModule: "src/platform/compliance/crypto-shredding/index.ts",
        description: "Key lifecycle, crypto-shredding orchestration, and secure delete baselines.",
        baselineServices: ["CryptoShreddingService", "DekManager"],
    },
    {
        capabilityId: "data-residency",
        entryModule: "src/platform/compliance/data-residency/index.ts",
        description: "Residency policy routing, location constraints, and data placement baselines.",
        baselineServices: ["DataResidencyPolicyService"],
    },
    {
        capabilityId: "encryption",
        entryModule: "src/platform/compliance/encryption/index.ts",
        description: "Envelope encryption, rotation orchestration, and protected storage baselines.",
        baselineServices: ["FieldEncryptionService"],
    },
    {
        capabilityId: "erasure",
        entryModule: "src/platform/compliance/erasure/index.ts",
        description: "Erasure requests, redaction execution, and legal deletion workflow baselines.",
        baselineServices: ["ErasurePlanningService"],
    },
    {
        capabilityId: "lineage",
        entryModule: "src/platform/compliance/lineage/index.ts",
        description: "Evidence lineage, provenance tracking, and compliance trace baselines.",
        baselineServices: ["DataLineageService"],
    },
]);
export function listComplianceCapabilityBaselines() {
    return COMPLIANCE_CAPABILITY_BASELINES;
}
export function resolveComplianceCapabilityBaseline(capabilityId) {
    const baseline = COMPLIANCE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
    if (baseline == null) {
        throw new Error(`compliance_capability.not_found:${capabilityId}`);
    }
    return baseline;
}
//# sourceMappingURL=compliance-baseline.js.map