export class ConflictResolver {
  public resolve<T>(serverValue: T, localValue: T, strategy: "server_wins" | "local_wins" = "server_wins"): T {
    return strategy === "local_wins" ? localValue : serverValue;
  }
}
