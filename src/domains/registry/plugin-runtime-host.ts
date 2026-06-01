import { fork, spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { ValidationError } from "../../platform/contracts/errors.js";
import { STDERR_TAIL_BUFFER_BYTES } from "../../platform/contracts/constants/io.js";
import { getProcessTracker } from "../../platform/five-plane-execution/resource/process-tracker.js";
import { newId } from "../../platform/contracts/types/ids.js";
import { createLazyStructuredLogger } from "../../platform/shared/observability/lazy-structured-logger.js";
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
import { parsePluginRuntimeMessage } from "./plugin-runtime-protocol.js";

const getPluginRuntimeHostLogger = createLazyStructuredLogger({
  retentionLimit: 100,
  service: "plugin-runtime-host",
});

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
  private trackedChildPid: number | null = null;
  private readyPromise: Promise<number> | null = null;
  private resolveReady: ((pid: number) => void) | null = null;
  private rejectReady: ((error: unknown) => void) | null = null;
  private stopping = false;

  protected constructor(options: PluginRuntimeHostOptions, sandboxRoot: string | null) {
    validatePluginId(options.pluginId);
    this.pluginId = options.pluginId;
    this.isolation = options.isolation;
    this.sandboxPolicy = options.sandboxPolicy;
    this.workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
    this.sandboxRoot = sandboxRoot;
    this.onReady = options.onReady ?? null;
    this.onExit = options.onExit ?? null;
    this.childModulePath = resolvePluginRuntimeChildModulePath(
      import.meta.url,
      this.workspaceRoot,
      this.isolation === "sandboxed_process",
    );
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
      this.cleanupChildResources(child);
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
    this.trackedChildPid = child.pid ?? null;
    getProcessTracker().register(child, "plugin-runtime", command, [this.pluginId, ...args]);
    child.once("error", (error) => {
      this.handleExit(error instanceof Error ? error.message : String(error));
    });
    child.once("exit", (code, signal) => {
      this.handleExit(`Plugin runtime exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`);
    });
  }

  protected handleMessage(message: unknown): void {
    let parsedMessage: PluginRuntimeMessage;
    try {
      parsedMessage = parsePluginRuntimeMessage(message);
    } catch (error) {
      this.handleExit(`Plugin runtime protocol violation: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (parsedMessage.type === "ready") {
      this.resolveReady?.(parsedMessage.pid);
      this.resolveReady = null;
      this.rejectReady = null;
      this.onReady?.({
        pid: parsedMessage.pid,
        sandboxRoot: this.sandboxRoot,
      });
      return;
    }
    if (parsedMessage.type !== "response") {
      return;
    }
    const pending = this.pending.get(parsedMessage.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(parsedMessage.requestId);
    if (parsedMessage.ok) {
      pending.resolve(parsedMessage.result);
      return;
    }
    pending.reject(this.buildError(parsedMessage));
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
    const child = this.child;
    if (child) {
      queueMicrotask(() => this.cleanupChildResources(child));
    }
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

  private cleanupChildResources(child: ChildProcess): void {
    if (this.trackedChildPid != null) {
      getProcessTracker().unregister(this.trackedChildPid);
      this.trackedChildPid = null;
    }
    child.stdout?.removeAllListeners();
    child.stderr?.removeAllListeners();
    child.stdin?.removeAllListeners();
    child.removeAllListeners("message");
    child.removeAllListeners("error");
    child.removeAllListeners("close");
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
        ? buildPluginRuntimeSandboxRoot(options.pluginId)
        : null,
    );
  }

  protected spawnChild(): void {
    this.beginSpawnLifecycle();
    const execArgv = [
      ...buildPluginRuntimeExecArgv({
        isolation: this.isolation,
        workspaceRoot: this.workspaceRoot,
        sandboxPolicy: this.sandboxPolicy,
        sandboxRoot: this.sandboxRoot,
        env: process.env,
      }),
      ...buildTypeScriptRuntimeLoaderArgs(this.childModulePath),
    ];
    const child = fork(this.childModulePath, [], {
      cwd: this.sandboxRoot ?? this.workspaceRoot,
      env: buildPluginRuntimeEnvironment({
        isolation: this.isolation,
        pluginId: this.pluginId,
        sandboxPolicy: this.sandboxPolicy,
        sandboxRoot: this.sandboxRoot,
        workspaceRoot: this.workspaceRoot,
      }),
      execArgv,
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    this.attachChild(child, process.execPath, [this.childModulePath]);
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-STDERR_TAIL_BUFFER_BYTES);
    });
    child.on("message", (message: unknown) => {
      this.handleMessage(message);
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
    super(options, buildPluginRuntimeSandboxRoot(options.pluginId));
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
        workspaceRoot: this.workspaceRoot,
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
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-STDERR_TAIL_BUFFER_BYTES);
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
        this.handleMessage(JSON.parse(line));
      } catch (error) {
        getPluginRuntimeHostLogger().warn("plugin_runtime_host.non_protocol_stdout", {
          pluginId: this.pluginId,
          line: line.slice(0, 512),
          error: error instanceof Error ? error.message : String(error),
        });
        this.stderrBuffer = `${this.stderrBuffer}\nnon-protocol-stdout:${line}`.trim().slice(-STDERR_TAIL_BUFFER_BYTES);
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
  workspaceRoot: string;
}

export interface ContainerizedPluginRuntimeLaunchSpec {
  command: string;
  args: string[];
}

const ContainerLauncherTemplateSchema = z.array(z.string().max(4096)).min(1).max(64);

interface BuildContainerizedPluginRuntimeLaunchSpecOptions {
  pluginId: string;
  childModulePath: string;
  workspaceRoot: string;
  sandboxRoot: string | null;
  runtimeImage: string | null;
  env: NodeJS.ProcessEnv;
}

function sanitizePluginIdForPath(pluginId: string): string {
  return pluginId.replace(/[^a-z0-9._-]/gi, "_");
}

function validatePluginId(pluginId: string): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(pluginId)) {
    throw new ValidationError(
      "plugin_spi.invalid_plugin_id",
      "plugin_spi.invalid_plugin_id",
      {
        retryable: false,
        details: {
          pluginId,
        },
      },
    );
  }
  if (pluginId.includes("..")) {
    throw new ValidationError(
      "plugin_spi.invalid_plugin_id",
      "plugin_spi.invalid_plugin_id",
      {
        retryable: false,
        details: {
          pluginId,
        },
      },
    );
  }
}

function validateContainerLaunchPluginId(pluginId: string): void {
  if (pluginId.includes("\0") || /['"`]/.test(pluginId)) {
    throw new ValidationError(
      "plugin_spi.invalid_plugin_id",
      "plugin_spi.invalid_plugin_id",
      {
        retryable: false,
        details: {
          pluginId,
        },
      },
    );
  }
}

export function buildPluginRuntimeSandboxRoot(
  pluginId: string,
  baseDir: string = join(process.cwd(), "data", "plugin-runtime-sandboxes"),
): string {
  validatePluginId(pluginId);
  return resolve(baseDir, sanitizePluginIdForPath(pluginId));
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

  for (const tempRoot of buildRuntimeTempRoots(options.env)) {
    readRoots.push(tempRoot);
    writeRoots.push(tempRoot);
  }

  return dedupeArgs([
    ...baseArgs,
    "--permission",
    "--allow-worker",
    "--allow-child-process",
    ...readRoots.map((root) => `--allow-fs-read=${root}`),
    ...writeRoots.map((root) => `--allow-fs-write=${root}`),
  ]);
}

function buildSandboxReadRoots(workspaceRoot: string, execArgs: readonly string[]): string[] {
  const roots = [
    resolve(workspaceRoot, "src"),
    resolve(workspaceRoot, "dist"),
    resolve(workspaceRoot, "node_modules"),
    resolve(workspaceRoot, "divisions"),
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

function buildRuntimeTempRoots(env: NodeJS.ProcessEnv): string[] {
  const roots = [
    tmpdir(),
    env.TMPDIR,
    env.TEMP,
    env.TMP,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return dedupeArgs(roots.map((value) => resolve(value)));
}

function resolvePluginRuntimeChildModulePath(
  currentModuleUrl: string,
  workspaceRoot: string,
  preferTypeScriptSource: boolean,
): string {
  const sourceDir = dirname(fileURLToPath(currentModuleUrl));
  const siblingTs = resolve(sourceDir, "plugin-runtime-child.ts");
  const distJs = resolve(workspaceRoot, "dist", "src", "domains", "registry", "plugin-runtime-child.js");
  const siblingJs = resolve(sourceDir, "plugin-runtime-child.js");
  const preferredOrder = preferTypeScriptSource
    ? [siblingTs, distJs, siblingJs]
    : [siblingJs, distJs, siblingTs];
  for (const candidate of preferredOrder) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return preferTypeScriptSource ? siblingTs : siblingJs;
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
    if (arg === "--test" || arg.startsWith("--test-")) {
      continue;
    }
    if (!isDangerousRuntimeDebugArg(arg)) {
      sanitized.push(arg);
    }
  }
  return sanitized;
}

function isDangerousRuntimeDebugArg(arg: string): boolean {
  return (
    arg.startsWith("--inspect")
    || arg.startsWith("--debug")
    || arg === "--prof"
    || arg.startsWith("--prof-")
  );
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
  env.AA_PLUGIN_WORKSPACE_ROOT = options.workspaceRoot;
  env.AA_DIVISIONS_ROOT = resolve(options.workspaceRoot, "divisions");
  return env;
}

function dedupeArgs(args: readonly string[]): string[] {
  return Array.from(new Set(args));
}

function buildTypeScriptRuntimeLoaderArgs(childModulePath: string): string[] {
  return childModulePath.endsWith(".ts") ? ["--import", "tsx"] : [];
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
  } catch (error) {
    throw new ValidationError(
      "plugin_spi.container_launcher_invalid_json",
      "plugin_spi.container_launcher_invalid_json",
      {
        retryable: false,
        details: {
          pluginId: options.pluginId,
          error: error instanceof Error ? error.message : String(error),
        },
      },
    );
  }
  const parsedTemplate = ContainerLauncherTemplateSchema.safeParse(template);
  if (!parsedTemplate.success) {
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

  validateContainerLaunchPluginId(options.pluginId);
  const rendered = maybeInjectTypeScriptRuntimeLoader(
    parsedTemplate.data.map((value) => renderContainerizedToken(value, options)),
    options.childModulePath,
  );
  if (rendered.length === 0 || (rendered[0]?.trim().length ?? 0) === 0) {
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
  const substitutions: Record<string, string> = {
    "{pluginId}": sanitizePluginIdForPath(options.pluginId),
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

function maybeInjectTypeScriptRuntimeLoader(rendered: string[], childModulePath: string): string[] {
  if (!childModulePath.endsWith(".ts")) {
    return rendered;
  }
  const nodeIndex = rendered.findIndex((value) => value === process.execPath);
  if (nodeIndex === -1) {
    return rendered;
  }
  return [
    ...rendered.slice(0, nodeIndex + 1),
    "--import",
    "tsx",
    ...rendered.slice(nodeIndex + 1),
  ];
}
