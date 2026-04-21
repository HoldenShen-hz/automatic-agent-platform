import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { loadDivisionRegistry, } from "./division-loader.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export function safeLoadDivisionRegistry() {
    try {
        return loadDivisionRegistry();
    }
    catch (err) {
        logger.warn("safeLoadDivisionRegistry failed", { error: err });
        return null;
    }
}
//# sourceMappingURL=safe-load-division-registry.js.map