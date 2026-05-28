import type { ConflictMetadata, ConflictResolutionStrategy } from "./types.js";

export class ConflictResolver {
  public resolve<T>(
    serverValue: T,
    localValue: T,
    strategy: ConflictResolutionStrategy = "server_wins",
    serverMetadata?: ConflictMetadata,
    localMetadata?: ConflictMetadata,
  ): T {
    if (strategy === "local_wins") {
      return localValue;
    }
    if (strategy === "merge") {
      return mergeValues(serverValue, localValue, serverMetadata, localMetadata);
    }
    return preferByLamport(serverValue, localValue, serverMetadata, localMetadata);
  }
}

function mergeValues<T>(
  serverValue: T,
  localValue: T,
  serverMetadata?: ConflictMetadata,
  localMetadata?: ConflictMetadata,
): T {
  if (Array.isArray(serverValue) && Array.isArray(localValue)) {
    return mergeArrays(serverValue, localValue, serverMetadata, localMetadata) as T;
  }
  if (isPlainObject(serverValue) && isPlainObject(localValue)) {
    return mergeObjects(serverValue, localValue, serverMetadata, localMetadata) as T;
  }
  return preferByLamport(serverValue, localValue, serverMetadata, localMetadata);
}

function mergeArrays(
  serverValue: readonly unknown[],
  localValue: readonly unknown[],
  serverMetadata?: ConflictMetadata,
  localMetadata?: ConflictMetadata,
): readonly unknown[] {
  const indexByIdentity = new Map<string, number>();
  const merged: unknown[] = [...serverValue];

  for (const [index, value] of merged.entries()) {
    const identity = getIdentityKey(value);
    if (identity != null) {
      indexByIdentity.set(identity, index);
    }
  }

  for (const value of localValue) {
    const identity = getIdentityKey(value);
    if (identity == null) {
      if (!merged.some((candidate) => isSameScalar(candidate, value))) {
        merged.push(value);
      }
      continue;
    }
    const existingIndex = indexByIdentity.get(identity);
    if (existingIndex == null) {
      indexByIdentity.set(identity, merged.length);
      merged.push(value);
      continue;
    }
    const serverClock = serverMetadata?.vectorClock[extractIdentityValue(identity)];
    const localClock = localMetadata?.vectorClock[extractIdentityValue(identity)];
    merged[existingIndex] = mergeValues(
      merged[existingIndex],
      value,
      serverClock == null ? undefined : { lamportTimestamp: serverClock.timestamp, vectorClock: {} },
      localClock == null ? undefined : { lamportTimestamp: localClock.timestamp, vectorClock: {} },
    );
  }

  return merged;
}

function mergeObjects(
  serverValue: Record<string, unknown>,
  localValue: Record<string, unknown>,
  serverMetadata?: ConflictMetadata,
  localMetadata?: ConflictMetadata,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...serverValue };
  const keys = new Set([...Object.keys(serverValue), ...Object.keys(localValue)]);

  for (const key of keys) {
    if (!(key in localValue)) {
      continue;
    }
    if (!(key in serverValue)) {
      merged[key] = localValue[key];
      continue;
    }

    const serverField = serverValue[key];
    const localField = localValue[key];
    if (Array.isArray(serverField) && Array.isArray(localField)) {
      merged[key] = mergeArrays(serverField, localField, serverMetadata, localMetadata);
      continue;
    }
    if (isPlainObject(serverField) && isPlainObject(localField)) {
      merged[key] = mergeObjects(serverField, localField, serverMetadata, localMetadata);
      continue;
    }
    const serverClock = serverMetadata?.vectorClock[key];
    const localClock = localMetadata?.vectorClock[key];
    if (serverClock != null || localClock != null) {
      merged[key] = (localClock?.timestamp ?? -1) > (serverClock?.timestamp ?? -1) ? localField : serverField;
      continue;
    }
    merged[key] = preferByLamport(serverField, localField, serverMetadata, localMetadata);
  }

  return merged;
}

function preferByLamport<T>(
  serverValue: T,
  localValue: T,
  serverMetadata?: ConflictMetadata,
  localMetadata?: ConflictMetadata,
): T {
  if (serverMetadata != null && localMetadata != null) {
    return localMetadata.lamportTimestamp > serverMetadata.lamportTimestamp ? localValue : serverValue;
  }
  return preferMostRecent(serverValue, localValue);
}

function preferMostRecent<T>(serverValue: T, localValue: T): T {
  const serverOrder = resolveVersionOrder(serverValue);
  const localOrder = resolveVersionOrder(localValue);
  if (serverOrder != null && localOrder != null) {
    return localOrder > serverOrder ? localValue : serverValue;
  }
  return serverValue;
}

function resolveVersionOrder(value: unknown): number | null {
  if (!isPlainObject(value)) {
    return null;
  }
  for (const key of ["lamport", "version", "clock"]) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  for (const key of ["updatedAt", "modifiedAt", "timestamp"]) {
    const candidate = value[key];
    if (typeof candidate === "string") {
      const parsed = Date.parse(candidate);
      if (!Number.isNaN(parsed) && parsed <= Date.now() + 5 * 60_000) {
        return parsed;
      }
    }
  }
  return null;
}

function extractIdentityValue(identity: string): string {
  const separatorIndex = identity.indexOf(":");
  return separatorIndex >= 0 ? identity.slice(separatorIndex + 1) : identity;
}

function getIdentityKey(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return null;
  }
  for (const key of ["id", "key", "name"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      return `${key}:${candidate}`;
    }
  }
  return null;
}

function isSameScalar(left: unknown, right: unknown): boolean {
  return left === right && (typeof left !== "object" || left == null);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
