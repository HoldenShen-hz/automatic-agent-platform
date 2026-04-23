import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
export class PackCatalogService {
    packs = new Map();
    createPack(input) {
        if (this.packs.has(input.packId)) {
            throw new ValidationError("pack.already_exists", `Pack ${input.packId} already exists.`, {
                details: { packId: input.packId },
            });
        }
        const now = nowIso();
        const record = {
            packId: input.packId,
            name: input.name,
            version: input.version,
            domainId: input.domainId,
            description: input.description ?? "",
            lifecycleStage: "draft",
            sandboxTier: input.sandboxTier ?? "process",
            createdAt: now,
            updatedAt: now,
            createdBy: input.createdBy,
            riskCount: input.riskCount ?? 0,
            dependencyCount: input.dependencyCount ?? 0,
            pluginCount: input.pluginCount ?? 0,
            toolBundleCount: input.toolBundleCount ?? 0,
        };
        this.packs.set(record.packId, record);
        return record;
    }
    getPack(packId) {
        return this.packs.get(packId) ?? null;
    }
    listPacks(limit = 50) {
        return [...this.packs.values()]
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, Math.max(0, limit));
    }
}
//# sourceMappingURL=pack-catalog-service.js.map