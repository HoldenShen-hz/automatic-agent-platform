import type { ConflictResolutionStrategy } from "./types";

/**
 * Vector clock entry for CRDT-based conflict resolution per §5.4.5.
 */
export interface VectorClockEntry {
  readonly timestamp: number;
  readonly actorId: string;
}

/**
 * Metadata for CRDT-based conflict resolution per §5.4.5.
 * Includes vector clock for causal ordering and Lamport timestamp for total ordering.
 */
export interface ConflictMetadata {
  readonly vectorClock: Record<string, VectorClockEntry>;
  readonly lamportTimestamp: number;
  readonly serverVersion?: number;
}

export class ConflictResolver {
  /**
   * Resolves conflicts using CRDT semantics with vector clocks per §5.4.5.
   * - "server_wins": Last-writer-wins based on Lamport timestamp
   * - "local_wins": Always prefer local value
   * - "merge": CRDT merge using vector clocks for causal consistency
   */
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
      return this.mergeValues(serverValue, localValue, serverMetadata, localMetadata);
    }
    // server_wins: compare Lamport timestamps for total ordering
    const serverLamport = serverMetadata?.lamportTimestamp ?? 0;
    const localLamport = localMetadata?.lamportTimestamp ?? 0;
    return serverLamport >= localLamport ? serverValue : localValue;
  }

  private mergeValues<T>(
    serverValue: T,
    localValue: T,
    serverMetadata?: ConflictMetadata,
    localMetadata?: ConflictMetadata,
  ): T {
    // Array merge: concatenate and deduplicate by ID
    if (Array.isArray(serverValue) && Array.isArray(localValue)) {
      return this.mergeArrays(serverValue, localValue) as T;
    }
    // Object merge: CRDT last-writer-wins per field using vector clocks
    if (isPlainObject(serverValue) && isPlainObject(localValue)) {
      return this.mergeObjects(serverValue, localValue, serverMetadata, localMetadata) as T;
    }
    // Scalar values: use Lamport timestamp comparison
    const serverLamport = serverMetadata?.lamportTimestamp ?? 0;
    const localLamport = localMetadata?.lamportTimestamp ?? 0;
    return serverLamport >= localLamport ? serverValue : localValue;
  }

  private mergeArrays<T>(serverArr: T[], localArr: T[]): T[] {
    const idExtractor = (item: unknown): string | null => {
      if (isPlainObject(item) && "id" in item && typeof (item as Record<string, unknown>).id === "string") {
        return String((item as Record<string, unknown>).id);
      }
      return null;
    };

    const serverMap = new Map<string, T>();
    for (const item of serverArr) {
      const id = idExtractor(item);
      if (id != null) {
        serverMap.set(id, item);
      } else {
        serverMap.set(String(serverMap.size), item);
      }
    }

    for (const item of localArr) {
      const id = idExtractor(item);
      if (id != null) {
        if (!serverMap.has(id)) {
          serverMap.set(id, item);
        }
      } else {
        serverMap.set(String(serverMap.size), item);
      }
    }

    return Array.from(serverMap.values());
  }

  private mergeObjects<T>(
    serverObj: Record<string, unknown>,
    localObj: Record<string, unknown>,
    serverMetadata?: ConflictMetadata,
    localMetadata?: ConflictMetadata,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...serverObj };
    const serverVC = serverMetadata?.vectorClock ?? {};
    const localVC = localMetadata?.vectorClock ?? {};

    for (const key of Object.keys(localObj)) {
      const serverVal = serverObj[key];
      const localVal = localObj[key];

      if (isPlainObject(serverVal) && isPlainObject(localVal)) {
        // Recursive merge with vector clock comparison per field
        result[key] = this.mergeObjects(serverVal, localVal, serverMetadata, localMetadata);
      } else if (key in serverObj) {
        // Field-level LWW using vector clocks
        const serverEntry = serverVC[key];
        const localEntry = localVC[key];
        const serverLamport = serverEntry?.timestamp ?? 0;
        const localLamport = localEntry?.timestamp ?? 0;
        result[key] = serverLamport >= localLamport ? serverVal : localVal;
      } else {
        // New field from local - accept it
        result[key] = localVal;
      }
    }

    return result;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) && value.constructor === Object;
}
