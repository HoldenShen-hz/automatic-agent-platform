import type { ConflictResolutionStrategy } from "./types";

export class ConflictResolver {
  public resolve<T>(serverValue: T, localValue: T, strategy: ConflictResolutionStrategy = "server_wins"): T {
    return strategy === "local_wins" ? localValue : serverValue;
  }
}
