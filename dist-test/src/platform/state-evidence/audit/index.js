import { newId, nowIso } from "../../contracts/types/ids.js";
export class AuditTrailService {
    records = [];
    record(input) {
        const record = {
            ...input,
            auditId: newId("audit"),
            createdAt: input.createdAt ?? nowIso(),
        };
        this.records.push(record);
        return record;
    }
    exportForTask(taskId) {
        return this.records.filter((record) => record.taskId === taskId);
    }
    exportForTenant(tenantId) {
        return this.records.filter((record) => record.tenantId === tenantId);
    }
    listRecords() {
        return [...this.records];
    }
}
//# sourceMappingURL=index.js.map