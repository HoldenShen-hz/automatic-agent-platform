import { newId, nowIso } from "../../contracts/types/ids.js";
export class AdminConfigService {
    records = new Map();
    applyUpdate(input) {
        const record = {
            updateId: newId("config_update"),
            key: input.key,
            value: input.value,
            tenantId: input.tenantId ?? null,
            updatedBy: input.updatedBy,
            updatedAt: nowIso(),
        };
        this.records.set(record.updateId, record);
        return record;
    }
    listUpdates(limit = 50, tenantId) {
        return [...this.records.values()]
            .filter((record) => tenantId == null || record.tenantId === tenantId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .slice(0, Math.max(0, limit));
    }
}
//# sourceMappingURL=admin-config-service.js.map