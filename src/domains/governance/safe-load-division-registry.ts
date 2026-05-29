import { createLazyStructuredLogger } from "../../platform/shared/observability/lazy-structured-logger.js";
import {
  loadDivisionRegistry,
  type DivisionRegistry,
} from "./division-loader.js";

const getLogger = createLazyStructuredLogger({ retentionLimit: 100, service: "safe-load-division-registry" });

export function safeLoadDivisionRegistry(): DivisionRegistry | null {
  try {
    return loadDivisionRegistry();
  } catch (err) {
    getLogger().warn("safeLoadDivisionRegistry failed", { error: err });
    return null;
  }
}
