import type { ConflictResolutionStrategy } from "./types";

export class ConflictResolver {
  public resolve<T>(serverValue: T, localValue: T, strategy: ConflictResolutionStrategy = "server_wins"): T {
    if (strategy === "local_wins") {
      return localValue;
    }
    if (strategy === "merge") {
      return mergeValues(serverValue, localValue);
    }
    return serverValue;
  }
}

function mergeValues<T>(serverValue: T, localValue: T): T {
  if (Array.isArray(serverValue) && Array.isArray(localValue)) {
    return [...serverValue, ...localValue] as T;
  }
  if (isPlainObject(serverValue) && isPlainObject(localValue)) {
    return {
      ...serverValue,
      ...localValue,
    } as T;
  }
  return localValue;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
