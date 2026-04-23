import { type ChildProcess } from "node:child_process";
import type { PluginLifecycleContext, PluginRuntimeIsolation, PluginSandboxPolicy } from "./plugin-spi.js";
import type { PluginRuntimeAction, PluginRuntimeChildMessage, PluginRuntimeMessage, PluginRuntimeRequest } from "./plugin-runtime-protocol.js";
export interface PluginRuntimeReadyMetadata {
    pid: number;
    sandboxRoot: string | null;
}
interface PluginRuntimeHostOptions {
    pluginId: string;
    isolation: PluginRuntimeIsolation;
    sandboxPolicy: PluginSandboxPolicy;
    workspaceRoot?: string;
    onReady?(metadata: PluginRuntimeReadyMetadata): void;
    onExit?(unexpected: boolean): void;
}
declare abstract class BasePluginRuntimeHost {
    protected readonly pluginId: string;
    protected readonly isolation: PluginRuntimeIsolation;
    protected readonly sandboxPolicy: PluginSandboxPolicy;
    protected readonly workspaceRoot: string;
    protected readonly sandboxRoot: string | null;
    protected readonly onReady: ((metadata: PluginRuntimeReadyMetadata) => void) | null;
    protected readonly onExit: ((unexpected: boolean) => void) | null;
    protected readonly childModulePath: string;
    private readonly pending;
    private child;
    private readyPromise;
    private resolveReady;
    private rejectReady;
    private stopping;
    protected constructor(options: PluginRuntimeHostOptions, sandboxRoot: string | null);
    start(): Promise<number>;
    invoke<T>(action: PluginRuntimeAction, context: PluginLifecycleContext | null, input?: unknown): Promise<T>;
    stop(): Promise<void>;
    protected beginSpawnLifecycle(): void;
    protected attachChild(child: ChildProcess, command?: string, args?: readonly string[]): void;
    protected handleMessage(message: PluginRuntimeMessage): void;
    protected handleExit(message: string): void;
    protected rejectPendingRequest(requestId: string): void;
    private buildError;
    protected abstract spawnChild(): void;
    protected abstract isChildAvailable(child: ChildProcess): boolean;
    protected abstract sendRequest(child: ChildProcess, request: PluginRuntimeRequest, requestId: string, reject: (error: unknown) => void): void;
    protected abstract sendShutdown(child: ChildProcess, shutdownMessage: PluginRuntimeChildMessage, timer: NodeJS.Timeout): void;
}
export declare class ForkedPluginRuntimeHost extends BasePluginRuntimeHost {
    constructor(options: PluginRuntimeHostOptions);
    protected spawnChild(): void;
    protected isChildAvailable(child: ChildProcess): boolean;
    protected sendRequest(child: ChildProcess, request: PluginRuntimeRequest, requestId: string, reject: (error: unknown) => void): void;
    protected sendShutdown(child: ChildProcess, shutdownMessage: PluginRuntimeChildMessage, timer: NodeJS.Timeout): void;
}
export declare class ContainerizedPluginRuntimeHost extends BasePluginRuntimeHost {
    private stdoutBuffer;
    private stderrBuffer;
    constructor(options: PluginRuntimeHostOptions);
    protected spawnChild(): void;
    protected isChildAvailable(child: ChildProcess): boolean;
    protected sendRequest(child: ChildProcess, request: PluginRuntimeRequest, requestId: string, reject: (error: unknown) => void): void;
    protected sendShutdown(child: ChildProcess, shutdownMessage: PluginRuntimeChildMessage, timer: NodeJS.Timeout): void;
    protected handleExit(message: string): void;
    private consumeStdout;
}
interface BuildPluginRuntimeExecArgvOptions {
    isolation: PluginRuntimeIsolation;
    workspaceRoot: string;
    sandboxPolicy: PluginSandboxPolicy;
    sandboxRoot: string | null;
    env: NodeJS.ProcessEnv;
}
export interface ContainerizedPluginRuntimeLaunchSpec {
    command: string;
    args: string[];
}
interface BuildContainerizedPluginRuntimeLaunchSpecOptions {
    pluginId: string;
    childModulePath: string;
    workspaceRoot: string;
    sandboxRoot: string | null;
    runtimeImage: string | null;
    env: NodeJS.ProcessEnv;
}
export declare function buildPluginRuntimeSandboxRoot(pluginId: string, baseDir?: string): string;
export declare function buildPluginRuntimeExecArgv(options: BuildPluginRuntimeExecArgvOptions): string[];
export declare function buildContainerizedPluginRuntimeLaunchSpec(options: BuildContainerizedPluginRuntimeLaunchSpecOptions): ContainerizedPluginRuntimeLaunchSpec;
export {};
