import type { KnowledgeNamespace } from "../knowledge-model.js";
export declare class NamespacePolicyStore {
    private readonly namespaces;
    register(namespace: KnowledgeNamespace): KnowledgeNamespace;
    get(path: string): KnowledgeNamespace | null;
    list(): KnowledgeNamespace[];
}
