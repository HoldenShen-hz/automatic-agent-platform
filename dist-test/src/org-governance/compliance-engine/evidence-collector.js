import { newId, nowIso } from "../../platform/contracts/types/ids.js";
export class ComplianceEvidenceCollector {
    records = new Map();
    collect(input) {
        const record = {
            ...input,
            evidenceId: newId("compliance_evidence"),
            collectedAt: input.collectedAt ?? nowIso(),
        };
        this.records.set(record.frameworkId, [...(this.records.get(record.frameworkId) ?? []), record]);
        return record;
    }
    list(frameworkId) {
        if (frameworkId == null) {
            return [...this.records.values()].flatMap((items) => items);
        }
        return [...(this.records.get(frameworkId) ?? [])];
    }
}
//# sourceMappingURL=evidence-collector.js.map