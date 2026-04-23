export type HarnessMemoryNamespace = "run" | "domain" | "shared";
export interface HarnessMemoryRecord {
    readonly namespace: HarnessMemoryNamespace;
    readonly scopeId: string;
    readonly key: string;
    readonly value: unknown;
}
export declare class HarnessMemoryManager {
    private readonly namespaces;
    write(namespace: HarnessMemoryNamespace, scopeId: string, key: string, value: unknown): void;
    read(namespace: HarnessMemoryNamespace, scopeId: string, key: string): unknown;
    list(namespace: HarnessMemoryNamespace, scopeId: string): readonly HarnessMemoryRecord[];
}
