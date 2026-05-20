import { newId } from "../../contracts/types/ids.js";

export interface BackgroundTaskTraceContext {
  readonly traceId: string;
  readonly correlationId: string;
}

export function createBackgroundTaskTraceContext(
  operation: string,
  parts: readonly (string | number | null | undefined)[] = [],
): BackgroundTaskTraceContext {
  const correlationParts = [operation];
  for (const part of parts) {
    if (part == null) {
      continue;
    }
    const value = String(part).trim();
    if (value.length > 0) {
      correlationParts.push(value);
    }
  }
  return {
    traceId: newId("trace"),
    correlationId: correlationParts.join(":"),
  };
}
