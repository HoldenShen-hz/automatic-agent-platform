export type HarnessMemoryNamespace = "run" | "domain" | "shared";

export interface HarnessMemoryRecord {
  readonly namespace: HarnessMemoryNamespace;
  readonly scopeId: string;
  readonly key: string;
  readonly value: unknown;
}

export class HarnessMemoryManager {
  private readonly namespaces = {
    run: new Map<string, Map<string, unknown>>(),
    domain: new Map<string, Map<string, unknown>>(),
    shared: new Map<string, Map<string, unknown>>(),
  } satisfies Record<HarnessMemoryNamespace, Map<string, Map<string, unknown>>>;

  public write(namespace: HarnessMemoryNamespace, scopeId: string, key: string, value: unknown): void {
    const scoped = this.namespaces[namespace].get(scopeId) ?? new Map<string, unknown>();
    scoped.set(key, value);
    this.namespaces[namespace].set(scopeId, scoped);
  }

  public read(namespace: HarnessMemoryNamespace, scopeId: string, key: string): unknown {
    return this.namespaces[namespace].get(scopeId)?.get(key) ?? null;
  }

  public list(namespace: HarnessMemoryNamespace, scopeId: string): readonly HarnessMemoryRecord[] {
    const scoped = this.namespaces[namespace].get(scopeId);
    if (!scoped) {
      return [];
    }
    return [...scoped.entries()].map(([key, value]) => ({
      namespace,
      scopeId,
      key,
      value,
    }));
  }
}
