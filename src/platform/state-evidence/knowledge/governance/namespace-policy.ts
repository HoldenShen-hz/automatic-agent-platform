import type { KnowledgeNamespace } from "../knowledge-model.js";

export class NamespacePolicyStore {
  private readonly namespaces = new Map<string, KnowledgeNamespace>();

  public register(namespace: KnowledgeNamespace): KnowledgeNamespace {
    this.namespaces.set(namespace.path, namespace);
    return namespace;
  }

  public get(path: string): KnowledgeNamespace | null {
    return this.namespaces.get(path) ?? null;
  }

  public list(): KnowledgeNamespace[] {
    return [...this.namespaces.values()];
  }
}
