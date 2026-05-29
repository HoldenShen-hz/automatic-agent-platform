type SharedWorkerConnectEvent = MessageEvent & {
    readonly ports: readonly MessagePort[];
};
declare const self: typeof globalThis & {
    onconnect: ((event: SharedWorkerConnectEvent) => void) | null;
};
export declare function installSharedWorkerSocketRuntime(sharedWorkerGlobal?: typeof self): void;
export {};
