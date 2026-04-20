import { createHash } from "node:crypto";

export interface ModelGatewayCacheEntry<TValue = unknown> {
  cacheKey: string;
  tenantId: string | null;
  model: string;
  routeClass: string;
  value: TValue;
  createdAt: string;
  expiresAt: string | null;
}

export class ModelGatewayCacheService<TValue = unknown> {
  private readonly entries = new Map<string, ModelGatewayCacheEntry<TValue>>();

  public buildCacheKey(input: {
    tenantId?: string | null;
    model: string;
    routeClass: string;
    messages: readonly { role: string; content: string }[];
  }): string {
    const normalizedPrompt = JSON.stringify(
      input.messages.map((message) => ({ role: message.role, content: message.content.trim() })),
    );
    return createHash("sha256")
      .update(JSON.stringify({
        tenantId: input.tenantId ?? null,
        model: input.model,
        routeClass: input.routeClass,
        prompt: normalizedPrompt,
      }))
      .digest("hex");
  }

  public put(input: {
    cacheKey: string;
    tenantId?: string | null;
    model: string;
    routeClass: string;
    value: TValue;
    createdAt?: string;
    ttlMs?: number | null;
  }): ModelGatewayCacheEntry<TValue> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const expiresAt =
      input.ttlMs == null
        ? null
        : new Date(new Date(createdAt).getTime() + input.ttlMs).toISOString();
    const entry: ModelGatewayCacheEntry<TValue> = {
      cacheKey: input.cacheKey,
      tenantId: input.tenantId ?? null,
      model: input.model,
      routeClass: input.routeClass,
      value: input.value,
      createdAt,
      expiresAt,
    };
    this.entries.set(entry.cacheKey, entry);
    return entry;
  }

  public get(cacheKey: string, now: string = new Date().toISOString()): ModelGatewayCacheEntry<TValue> | null {
    const entry = this.entries.get(cacheKey);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt != null && entry.expiresAt <= now) {
      this.entries.delete(cacheKey);
      return null;
    }
    return entry;
  }

  public invalidate(cacheKey: string): boolean {
    return this.entries.delete(cacheKey);
  }

  public listEntries(): ModelGatewayCacheEntry<TValue>[] {
    return [...this.entries.values()];
  }
}
