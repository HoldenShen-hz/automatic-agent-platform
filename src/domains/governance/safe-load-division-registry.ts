import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import {
  loadDivisionRegistry,
  type DivisionRegistry,
} from "./division-loader.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export function safeLoadDivisionRegistry(): DivisionRegistry | null {
  try {
    return loadDivisionRegistry();
  } catch (err) {
    logger.warn("safeLoadDivisionRegistry failed", { error: err });
    return null;
  }
}
