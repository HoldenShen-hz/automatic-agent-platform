import { fork, spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ValidationError } from "../../platform/contracts/errors.js";
import { getProcessTracker } from "../../platform/execution/resource/process-tracker.js";
import { newId } from "../../platform/contracts/types/ids.js";
import type {
  PluginLifecycleContext,
  PluginRuntimeIsolation,
  PluginSandboxPolicy,
} from "./plugin-spi.js";
import type {
  PluginRuntimeAction,
  PluginRuntimeChildMessage,
  PluginRuntimeMessage,
  PluginRuntimeRequest,
  PluginRuntimeResponse,
} from "./plugin-runtime-protocol.js";

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

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

abstract class BasePluginRuntimeHost {
  protected readonly pluginId: string;
  protected readonly isolation: PluginRuntimeIsolation;
  protected readonly sandboxPolicy: PluginSandboxPolicy;
  protected readonly workspaceRoot: string;
  protected readonly sandboxRoot: string | null;
  protected readonly onReady: ((metadata: PluginRuntimeReadyMetadata) => void) | null;
  protected readonly onExit: ((unexpected: boolean) => void) | null;
  protected readonly childModulePath: string;

  private readonly pending = new Map<string, PendingRequest>();
  private child: ChildProcess | null = null;
  private readyPromise: Promise<number> | null = null;
  private resolveReady: ((pid: number) => void) | null = null;
  private rejectReady: ((error: unknown) => void) | null = null;
  private stopping = false;

  protected constructor(options: PluginRuntimeHostOptions, sandboxRoot: string | null) {
    this.pluginId = options.pluginId;
    this.isolation = options.isolation;
    this.sandboxPolicy = options.sandboxPolicy;
    this.workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
    this.sandboxRoot = sandboxRoot;
    this.onReady = options.onReady ?? null;
    this.onExit = options.onExit ?? null;
    this.childModulePath = resolvePluginRuntimeChildModulePath(import.meta.url, this.workspaceRoot);
  }

  public async start(): Promise<number> {
    if (this.child && this.isChildAvailable(this.child) && this.readyPromise) {
      return this.readyPromise;
    }
    this.spawnChild();
    return this.readyPromise!;
  }

  public async invoke<T>(
    action: PluginRuntimeAction,
    context: PluginLifecycleContext | null,
    input?: unknown,
  ): Promise<T> {
    await this.start();
    if (!this.child || !this.isChildAvailable(this.child)) {
      throw new Error(`Plugin runtime for ${this.pluginId} is unavailable.`);
    }
    return new Promise<T>((resolve, reject) => {
      const requestId = newId("plugin_runtime");
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      const request: PluginRuntimeRequest = {
        type: "request",
        requestId,
        pluginId: this.pluginId,
        action,
        context,
        ...(input !== undefined ? { input } : {}),
      };
      this.sendRequest(this.child!, request, requestId, reject);
    });
  }

  public async stop(): Promise<void> {
    const child = this.child;
    if (!child) {
      return;
    }
    this.stopping = true;
    if (child.exitCode != null || child.killed) {
      this.child = null;
      this.readyPromise = null;
      this.stopping = false;
      return;
    }
    await new Promise<void>((resolveStop) => {
      const timer = setTimeout(() => {
        child.kill();
      }, 250);
      child.once("exit", () => {
        clearTimeout(timer);
        resolveStop();
      });
      this.sendShutdown(child, { type: "shutdown" }, timer);
    });
  }

  protected beginSpawnLifecycle(): void {
    this.stopping = false;
    this.readyPromise = new Promise<number>((resolveReady, rejectReady) => {
      this.resolveReady = resolveReady;
      this.rejectReady = rejectReady;
    });
    if (this.sandboxRoot) {
      mkdirSync(this.sandboxRoot, { recursive: true });
    }
  }

  protected attachChild(
    child: ChildProcess,
    command: string = process.execPath,
    args: readonly string[] = [this.childModulePath],
  ): void {
    this.child = child;
    getProcessTracker().register(child, "unknown", command, [...args]);
    child.once("error", (error) => {
      this.handleExit(error instanceof Error ? error.message : String(error));
    });
    child.once("exit", (code, signal) => {
      this.handleExit(`Plugin runtime exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`);
    });
  }

  protected handleMessage(message: PluginRuntimeMessage): void {
    if (message.type === "ready") {
      this.resolveReady?.(message.pid);
      this.resolveReady = null;
      this.rejectReady = null;
      this.onReady?.({
        pid: message.pid,
        sandboxRoot: this.sandboxRoot,
      });
      return;
    }
    if (message.type !== "response") {
      return;
    }
    const pending = this.pending.get(message.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(message.requestId);
    if (message.ok) {
      pending.resolve(message.result);
      return;
    }
    pending.reject(this.buildError(message));
  }

  protected handleExit(message: string): void {
    const unexpected = !this.stopping;
    const error = new Error(message);
    this.rejectReady?.(error);
    this.resolveReady = null;
    this.rejectReady = null;
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    this.child = null;
    this.readyPromise = null;
    this.stopping = false;
    this.onExit?.(unexpected);
  }

  protected rejectPendingRequest(requestId: string): void {
    this.pending.delete(requestId);
  }

  private buildError(message: PluginRuntimeResponse): Error {
    if (!message.error) {
      return new Error(`Plugin runtime for ${this.pluginId} returned an unknown error.`);
    }
    const error = new Error(message.error.message);
    error.name = message.error.name;
    return error;
  }

  protected abstract spawnChild(): void;
  protected abstract isChildAvailable(child: ChildProcess): boolean;
  protected abstract sendRequest(
    child: ChildProcess,
    request: PluginRuntimeRequest,
    requestId: string,
    reject: (error: unknown) => void,
  ): void;
  protected abstract sendShutdown(
    child: ChildProcess,
    shutdownMessage: PluginRuntimeChildMessage,
    timer: NodeJS.Timeout,
  ): void;
}

export class ForkedPluginRuntimeHost extends BasePluginRuntimeHost {
  private stderrBuffer = "";

  public constructor(options: PluginRuntimeHostOptions) {
    super(
      options,
      options.isolation === "sandboxed_process"
        ? buildEphemeralPluginRuntimeSandboxRoot(options.pluginId)
        : null,
    );
  }

  protected spawnChild(): void {
    this.beginSpawnLifecycle();
    const child = fork(this.childModulePath, [], {
      cwd: this.sandboxRoot ?? this.workspaceRoot,
      env: buildPluginRuntimeEnvironment({
        isolation: this.isolation,
        pluginId: this.pluginId,
        sandboxPolicy: this.sandboxPolicy,
        sandboxRoot: this.sandboxRoot,
      }),
      execArgv: buildPluginRuntimeExecArgv({
        isolation: this.isolation,
        workspaceRoot: this.workspaceRoot,
        sandboxPolicy: this.sandboxPolicy,
        sandboxRoot: this.sandboxRoot,
        env: process.env,
      }),
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    this.attachChild(child, process.execPath, [this.childModulePath]);
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-4096);
    });
    child.on("message", (message: unknown) => {
      this.handleMessage(message as PluginRuntimeMessage);
    });
  }

  protected isChildAvailable(child: ChildProcess): boolean {
    return child.connected === true;
  }

  protected sendRequest(
    child: ChildProcess,
    request: PluginRuntimeRequest,
    requestId: string,
    reject: (error: unknown) => void,
  ): void {
    child.send(request, (error) => {
      if (!error) {
        return;
      }
      this.rejectPendingRequest(requestId);
      reject(error);
    });
  }

  protected sendShutdown(
    child: ChildProcess,
    shutdownMessage: PluginRuntimeChildMessage,
    timer: NodeJS.Timeout,
  ): void {
    child.send(shutdownMessage, (error) => {
      if (!error) {
        return;
      }
      clearTimeout(timer);
      child.kill();
    });
  }

  protected override handleExit(message: string): void {
    const stderr = this.stderrBuffer.trim();
    this.stderrBuffer = "";
    super.handleExit(stderr.length > 0 ? `${message} stderr=${stderr}` : message);
  }
}

export class ContainerizedPluginRuntimeHost extends BasePluginRuntimeHost {
  private stdoutBuffer = "";
  private stderrBuffer = "";

  public constructor(options: PluginRuntimeHostOptions) {
    super(options, buildEphemeralPluginRuntimeSandboxRoot(options.pluginId));
  }

  protected spawnChild(): void {
    this.beginSpawnLifecycle();
    const spec = buildContainerizedPluginRuntimeLaunchSpec({
      pluginId: this.pluginId,
      childModulePath: this.childModulePath,
      workspaceRoot: this.workspaceRoot,
      sandboxRoot: this.sandboxRoot,
      runtimeImage: this.sandboxPolicy.runtimeContainerImage ?? null,
      env: process.env,
    });
    const child = spawn(spec.command, spec.args, {
      cwd: this.sandboxRoot ?? this.workspaceRoot,
      env: buildPluginRuntimeEnvironment({
        isolation: this.isolation,
        pluginId: this.pluginId,
        sandboxPolicy: this.sandboxPolicy,
        sandboxRoot: this.sandboxRoot,
      }),
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.attachChild(child, spec.command, spec.args);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.stdoutBuffer += chunk;
      this.consumeStdout();
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-4096);
    });
  }

  protected isChildAvailable(child: ChildProcess): boolean {
    return child.exitCode == null && child.killed === false;
  }

  protected sendRequest(
    child: ChildProcess,
    request: PluginRuntimeRequest,
    requestId: string,
    reject: (error: unknown) => void,
  ): void {
    (child as ChildProcessWithoutNullStreams).stdin.write(`${JSON.stringify(request)}\n`, (error) => {
      if (!error) {
        return;
      }
      this.rejectPendingRequest(requestId);
      reject(error);
    });
  }

  protected sendShutdown(
    child: ChildProcess,
    shutdownMessage: PluginRuntimeChildMessage,
    timer: NodeJS.Timeout,
  ): void {
    (child as ChildProcessWithoutNullStreams).stdin.write(`${JSON.stringify(shutdownMessage)}\n`, (error) => {
      if (!error) {
        return;
      }
      clearTimeout(timer);
      child.kill();
    });
  }

  protected override handleExit(message: string): void {
    const stderr = this.stderrBuffer.trim();
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    super.handleExit(stderr.length > 0 ? `${message} stderr=${stderr}` : message);
  }

  private consumeStdout(): void {
    while (true) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line.length === 0) {
        continue;
      }
      try {
        this.handleMessage(JSON.parse(line) as PluginRuntimeMessage);
      } catch {
        this.stderrBuffer = `${this.stderrBuffer}\nnon-protocol-stdout:${line}`.trim().slice(-4096);
      }
    }
  }
}

interface BuildPluginRuntimeExecArgvOptions {
  isolation: PluginRuntimeIsolation;
  workspaceRoot: string;
  sandboxPolicy: PluginSandboxPolicy;
  sandboxRoot: string | null;
  env: NodeJS.ProcessEnv;
}

interface BuildPluginRuntimeEnvironmentOptions {
  isolation: PluginRuntimeIsolation;
  pluginId: string;
  sandboxPolicy: PluginSandboxPolicy;
  sandboxRoot: string | null;
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

function sanitizePluginIdForPath(pluginId: string): string {
  return pluginId.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-");
}

export function buildPluginRuntimeSandboxRoot(
  pluginId: string,
  baseDir: string = join(process.cwd(), "data", "plugin-runtime-sandboxes"),
): string {
  return resolve(baseDir, sanitizePluginIdForPath(pluginId));
}

function buildEphemeralPluginRuntimeSandboxRoot(
  pluginId: string,
  baseDir: string = join(process.cwd(), "data", "plugin-runtime-sandboxes"),
): string {
  return resolve(buildPluginRuntimeSandboxRoot(pluginId, baseDir), newId("runtime"));
}

export function buildPluginRuntimeExecArgv(options: BuildPluginRuntimeExecArgvOptions): string[] {
  const baseArgs = sanitizePluginRuntimeExecArgs(process.execArgv);
  if (options.isolation !== "sandboxed_process") {
    return dedupeArgs(baseArgs);
  }

  const readRoots = buildSandboxReadRoots(options.workspaceRoot, baseArgs);
  const writeRoots: string[] = [];
  if (options.sandboxRoot) {
    readRoots.push(resolve(options.sandboxRoot));
    if (options.sandboxPolicy.allowFilesystemWrite) {
      writeRoots.push(resolve(options.sandboxRoot));
    }
  }

  const coverageDir = options.env.NODE_V8_COVERAGE?.trim();
  if (coverageDir) {
    const normalizedCoverageDir = resolve(coverageDir);
    readRoots.push(normalizedCoverageDir);
    writeRoots.push(normalizedCoverageDir);
  }

  return dedupeArgs([
    ...baseArgs,
    "--permission",
    ...readRoots.map((root) => `--allow-fs-read=${root}`),
    ...writeRoots.map((root) => `--allow-fs-write=${root}`),
  ]);
}

function buildSandboxReadRoots(workspaceRoot: string, execArgs: readonly string[]): string[] {
  const roots = [
    resolve(workspaceRoot, "src"),
    resolve(workspaceRoot, "dist"),
    resolve(workspaceRoot, "node_modules"),
    resolve(workspaceRoot, "package.json"),
  ];
  for (const arg of execArgs) {
    const derivedRoot = deriveReadablePathFromExecArg(arg);
    if (derivedRoot) {
      roots.push(derivedRoot);
    }
  }
  return roots;
}

function resolvePluginRuntimeChildModulePath(currentModuleUrl: string, workspaceRoot: string): string {
  const sourceDir = dirname(fileURLToPath(currentModuleUrl));
  const siblingJs = resolve(sourceDir, "plugin-runtime-child.js");
  if (existsSync(siblingJs)) {
    return siblingJs;
  }
  const distJs = resolve(workspaceRoot, "dist", "src", "domains", "registry", "plugin-runtime-child.js");
  if (existsSync(distJs)) {
    return distJs;
  }
  const siblingTs = resolve(sourceDir, "plugin-runtime-child.ts");
  if (existsSync(siblingTs)) {
    return siblingTs;
  }
  return siblingJs;
}

function sanitizePluginRuntimeExecArgs(execArgs: readonly string[]): string[] {
  const sanitized: string[] = [];
  for (let index = 0; index < execArgs.length; index++) {
    const arg = execArgs[index]!;
    if (
      (arg === "--import" || arg === "--loader" || arg === "--require")
      && index + 1 < execArgs.length
      && isTsxLoaderSpecifier(execArgs[index + 1]!)
    ) {
      index++;
      continue;
    }
    if (matchesInlineTsxLoaderArg(arg)) {
      continue;
    }
    if (!arg.startsWith("--inspect")) {
      sanitized.push(arg);
    }
  }
  return sanitized;
}

function matchesInlineTsxLoaderArg(arg: string): boolean {
  for (const prefix of ["--import=", "--loader=", "--require="] as const) {
    if (arg.startsWith(prefix) && isTsxLoaderSpecifier(arg.slice(prefix.length))) {
      return true;
    }
  }
  return false;
}

function isTsxLoaderSpecifier(value: string): boolean {
  const normalized = value.trim();
  return normalized === "tsx" || /(^|[\\/])tsx([\\/]|$)/.test(normalized);
}

function deriveReadablePathFromExecArg(arg: string): string | null {
  for (const prefix of ["--import=", "--loader=", "--require="] as const) {
    if (!arg.startsWith(prefix)) {
      continue;
    }
    const rawPath = arg.slice(prefix.length);
    if (rawPath.length === 0) {
      return null;
    }
    if (rawPath.startsWith("file://")) {
      return fileURLToPath(rawPath);
    }
    if (rawPath.startsWith("/")) {
      return resolve(rawPath);
    }
  }
  return null;
}

function buildPluginRuntimeEnvironment(options: BuildPluginRuntimeEnvironmentOptions): NodeJS.ProcessEnv {
  const forwardedKeys = [
    "PATH",
    "HOME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "TZ",
    "LANG",
    "LC_ALL",
    "NODE_V8_COVERAGE",
  ] as const;
  const env: NodeJS.ProcessEnv = {};
  for (const key of forwardedKeys) {
    const value = process.env[key];
    if (value != null && value.length > 0) {
      env[key] = value;
    }
  }
  env.AA_PLUGIN_RUNTIME_ISOLATION = options.isolation;
  env.AA_PLUGIN_RUNTIME_PLUGIN_ID = options.pluginId;
  env.AA_PLUGIN_ALLOW_NETWORK_EGRESS = String(options.sandboxPolicy.allowNetworkEgress);
  if (options.sandboxRoot) {
    env.AA_PLUGIN_SANDBOX_ROOT = options.sandboxRoot;
  }
  return env;
}

function dedupeArgs(args: readonly string[]): string[] {
  return Array.from(new Set(args));
}

export function buildContainerizedPluginRuntimeLaunchSpec(
  options: BuildContainerizedPluginRuntimeLaunchSpecOptions,
): ContainerizedPluginRuntimeLaunchSpec {
  const rawTemplate = options.env.AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON?.trim();
  if (!rawTemplate) {
    throw new ValidationError(
      "plugin_spi.container_launcher_missing",
      "plugin_spi.container_launcher_missing",
      {
        retryable: false,
        details: {
          pluginId: options.pluginId,
        },
      },
    );
  }
  let template: unknown;
  try {
    template = JSON.parse(rawTemplate);
  } catch {
    throw new ValidationError(
      "plugin_spi.container_launcher_invalid_json",
      "plugin_spi.container_launcher_invalid_json",
      {
        retryable: false,
        details: {
          pluginId: options.pluginId,
        },
      },
    );
  }
  if (!Array.isArray(template) || template.some((value) => typeof value !== "string")) {
    throw new ValidationError(
      "plugin_spi.container_launcher_invalid_shape",
      "plugin_spi.container_launcher_invalid_shape",
      {
        retryable: false,
        details: {
          pluginId: options.pluginId,
        },
      },
    );
  }

  const rendered = template.map((value) => renderContainerizedToken(value, options));
  if (rendered.length === 0 || rendered[0]!.trim().length === 0) {
    throw new ValidationError(
      "plugin_spi.container_launcher_empty_command",
      "plugin_spi.container_launcher_empty_command",
      {
        retryable: false,
        details: {
          pluginId: options.pluginId,
        },
      },
    );
  }

  return {
    command: rendered[0]!,
    args: rendered.slice(1),
  };
}

function renderContainerizedToken(
  token: string,
  options: BuildContainerizedPluginRuntimeLaunchSpecOptions,
): string {
  // §167-1946 SECURITY FIX: Sanitize pluginId before substitution to prevent injection.
  // Even though pluginId originates from plugin registry, a malicious registry entry
  // or corrupted state could provide a pluginId with shell metacharacters.
  // Template substitution must not allow pluginId to inject new command arguments
  // or break out of the expected argument structure.
  const sanitizedPluginId = options.pluginId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const substitutions: Record<string, string> = {
    "{pluginId}": sanitizedPluginId,
    "{workspaceRoot}": options.workspaceRoot,
    "{sandboxRoot}": options.sandboxRoot ?? options.workspaceRoot,
    "{runtimeImage}": options.runtimeImage ?? "",
    "{node}": process.execPath,
    "{childModulePath}": options.childModulePath,
  };
  let rendered = token;
  for (const [placeholder, value] of Object.entries(substitutions)) {
    rendered = rendered.split(placeholder).join(value);
  }
  return rendered;
}
