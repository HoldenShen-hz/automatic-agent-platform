import { createRequire, syncBuiltinESMExports } from "node:module";
import { existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "node:util";

import { createBuiltinPlugin } from "../../plugins/builtin-plugin-registry.js";
import { createLazyStructuredLogger } from "../../platform/shared/observability/lazy-structured-logger.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import type { RegisteredPlugin } from "./plugin-spi.js";
import type { PluginRuntimeChildMessage, PluginRuntimeRequest } from "./plugin-runtime-protocol.js";
import { parsePluginRuntimeChildMessage } from "./plugin-runtime-protocol.js";

const require = createRequire(import.meta.url);
const getLogger = createLazyStructuredLogger({ retentionLimit: 100, service: "plugin-runtime-child" });
const runtimeChildEntryPath = fileURLToPath(import.meta.url);
const bootCorrelationId = `boot:${process.pid}:${Date.now()}`;

let currentPluginId: string | null = null;
let currentPlugin: RegisteredPlugin | null = null;
let currentRequest: PluginRuntimeRequest | null = null;
let stdinBuffer = "";
let bootstrapInstalled = false;
let fatalRuntimeErrorHandled = false;

function getPlugin(pluginId: string): RegisteredPlugin {
  if (currentPluginId === pluginId && currentPlugin) {
    return currentPlugin;
  }
  const plugin = createBuiltinPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Builtin plugin ${pluginId} is not available for forked runtime isolation.`);
  }
  currentPluginId = pluginId;
  currentPlugin = plugin;
  return plugin;
}

async function handleRequest(request: PluginRuntimeRequest): Promise<unknown> {
  const plugin = getPlugin(request.pluginId);
  switch (request.action) {
    case "load":
      if (plugin.onLoad && request.context) {
        await plugin.onLoad(request.context);
      } else if (plugin.initialize) {
        await plugin.initialize();
      }
      return null;
    case "activate":
      if (plugin.onActivate && request.context) {
        await plugin.onActivate(request.context);
      }
      return null;
    case "health_check":
      return plugin.healthCheck ? await plugin.healthCheck() : true;
    case "deactivate":
      if (plugin.onDeactivate && request.context) {
        await plugin.onDeactivate(request.context);
      }
      return null;
    case "unload":
      if (plugin.onUnload && request.context) {
        await plugin.onUnload(request.context);
      } else if (plugin.shutdown) {
        await plugin.shutdown();
      }
      return null;
    case "retrieve":
      if (plugin.spiType !== "retriever") {
        throw new Error(`Plugin ${plugin.pluginId} is not a retriever.`);
      }
      return plugin.retrieve(request.input as Parameters<typeof plugin.retrieve>[0]);
    case "present":
      if (plugin.spiType !== "presenter") {
        throw new Error(`Plugin ${plugin.pluginId} is not a presenter.`);
      }
      return plugin.formatOutput(request.input as Parameters<typeof plugin.formatOutput>[0]);
    case "authenticate":
      if (plugin.spiType !== "adapter") {
        throw new Error(`Plugin ${plugin.pluginId} is not an adapter.`);
      }
      await plugin.authenticate(request.input as Parameters<typeof plugin.authenticate>[0]);
      return null;
    case "execute":
      if (plugin.spiType !== "adapter") {
        throw new Error(`Plugin ${plugin.pluginId} is not an adapter.`);
      }
      return plugin.execute(
        (request.input as { action: string; params: Record<string, unknown> }).action,
        (request.input as { action: string; params: Record<string, unknown> }).params,
      );
    default:
      throw new Error(`Unsupported plugin runtime action ${(request as { action?: string }).action ?? "unknown"}.`);
  }
}

function installRuntimeGuards(): void {
  const sandboxRoot = process.env.AA_PLUGIN_SANDBOX_ROOT?.trim();
  if (sandboxRoot) {
    process.chdir(resolveValidatedSandboxRoot(sandboxRoot));
  }
  if (process.env.AA_PLUGIN_ALLOW_NETWORK_EGRESS === "true") {
    return;
  }
  const deny = (): never => {
    throw new Error(`Plugin ${process.env.AA_PLUGIN_RUNTIME_PLUGIN_ID ?? "unknown"} cannot use network egress in ${process.env.AA_PLUGIN_RUNTIME_ISOLATION ?? "isolated"} runtime.`);
  };
  const http = require("node:http") as typeof import("node:http");
  const https = require("node:https") as typeof import("node:https");
  const net = require("node:net") as typeof import("node:net");
  const tls = require("node:tls") as typeof import("node:tls");

  http.request = deny as typeof http.request;
  http.get = deny as typeof http.get;
  https.request = deny as typeof https.request;
  https.get = deny as typeof https.get;
  net.connect = deny as typeof net.connect;
  net.createConnection = deny as typeof net.createConnection;
  tls.connect = deny as typeof tls.connect;
  globalThis.fetch = async (..._args) => {
    deny();
    throw new Error("plugin_runtime_child:network_denied");
  };
  syncBuiltinESMExports();
}

function installStdioProtocolConsoleRedirection(): void {
  if (process.send) {
    return;
  }
  const directEntry = process.argv[1];
  if (directEntry == null || resolve(directEntry) !== runtimeChildEntryPath) {
    return;
  }
}

function withStructuredConsoleForCurrentRequest<T>(run: () => Promise<T>): Promise<T> {
  if (process.send) {
    return run();
  }
  const directEntry = process.argv[1];
  if (directEntry == null || resolve(directEntry) !== runtimeChildEntryPath) {
    return run();
  }
  const writeStructuredLine = (level: "debug" | "info" | "warn" | "error", ...args: unknown[]): void => {
    const message = format(...args);
    const requestId = currentRequest?.requestId;
    const entry = getLogger().log({
      level,
      message,
      ...(requestId == null
        ? {
          traceId: bootCorrelationId,
          correlationId: bootCorrelationId,
        }
        : {
          requestId,
          traceId: requestId,
          correlationId: requestId,
        }),
      data: {
        pluginId: currentRequest?.pluginId ?? process.env.AA_PLUGIN_RUNTIME_PLUGIN_ID ?? currentPluginId,
        action: currentRequest?.action ?? null,
        domainId: currentRequest?.context?.domainId ?? null,
      },
    });
    process.stderr.write(`${JSON.stringify(entry)}\n`);
  };
  const originalConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
  };
  console.log = ((...args: unknown[]) => writeStructuredLine("info", ...args)) as typeof console.log;
  console.info = ((...args: unknown[]) => writeStructuredLine("info", ...args)) as typeof console.info;
  console.debug = ((...args: unknown[]) => writeStructuredLine("debug", ...args)) as typeof console.debug;
  console.warn = ((...args: unknown[]) => writeStructuredLine("warn", ...args)) as typeof console.warn;
  console.error = ((...args: unknown[]) => writeStructuredLine("error", ...args)) as typeof console.error;
  return run().finally(() => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });
}

function logProtocolError(message: string, error: unknown): void {
  const entry = getLogger().log({
    level: "error",
    message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
    traceId: bootCorrelationId,
    correlationId: bootCorrelationId,
    data: {
      pluginId: currentRequest?.pluginId ?? process.env.AA_PLUGIN_RUNTIME_PLUGIN_ID ?? currentPluginId,
      action: currentRequest?.action ?? null,
      domainId: currentRequest?.context?.domainId ?? null,
    },
  });
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

function handleFatalRuntimeError(kind: "unhandledRejection" | "uncaughtException", error: unknown): void {
  if (fatalRuntimeErrorHandled) {
    return;
  }
  fatalRuntimeErrorHandled = true;
  logProtocolError(`plugin-runtime-child ${kind}`, error);
  const activeRequest = currentRequest;
  if (activeRequest != null) {
    sendRuntimeMessage({
      type: "response",
      requestId: activeRequest.requestId,
      ok: false,
      pid: process.pid,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
  process.exitCode = 1;
  setImmediate(() => {
    process.exit(1);
  });
}

export function bootstrapPluginRuntimeChild(): void {
  if (bootstrapInstalled) {
    return;
  }
  bootstrapInstalled = true;
  installRuntimeGuards();
  installStdioProtocolConsoleRedirection();
  process.on("unhandledRejection", (error) => {
    handleFatalRuntimeError("unhandledRejection", error);
  });
  process.on("uncaughtException", (error) => {
    handleFatalRuntimeError("uncaughtException", error);
  });

  process.on("message", (message: unknown) => {
    handleRuntimeMessage(message);
  });

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    stdinBuffer += chunk;
    while (true) {
      const newlineIndex = stdinBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }
      const line = stdinBuffer.slice(0, newlineIndex).trim();
      stdinBuffer = stdinBuffer.slice(newlineIndex + 1);
      if (line.length === 0) {
        continue;
      }
      try {
        handleRuntimeMessage(JSON.parse(line) as PluginRuntimeChildMessage);
      } catch (error) {
        logProtocolError("plugin-runtime-child invalid stdio payload", error);
      }
    }
  });

  sendRuntimeMessage({
    type: "ready",
    pid: process.pid,
  });
}

function sendRuntimeMessage(message: unknown): void {
  if (!process.send) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
    return;
  }
  process.send(message);
}

function handleRuntimeMessage(message: unknown): void {
  let payload: PluginRuntimeChildMessage;
  try {
    payload = parsePluginRuntimeChildMessage(message);
  } catch (error) {
    logProtocolError("plugin-runtime-child protocol violation", error);
    return;
  }
  if (payload?.type === "shutdown") {
    process.disconnect?.();
    process.exitCode = 0;
    setImmediate(() => {
      process.emit("beforeExit", 0);
    });
    return;
  }
  const request = payload as PluginRuntimeRequest;
  currentRequest = request;
  void withStructuredConsoleForCurrentRequest(() => handleRequest(request))
    .then((result) => {
      sendRuntimeMessage({
        type: "response",
        requestId: request.requestId,
        ok: true,
        pid: process.pid,
        result,
      });
    })
    .catch((error) => {
      sendRuntimeMessage({
        type: "response",
        requestId: request.requestId,
        ok: false,
        pid: process.pid,
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    })
    .finally(() => {
      if (currentRequest?.requestId === request.requestId) {
        currentRequest = null;
      }
    });
}

if (process.argv[1] != null && resolve(process.argv[1]) === runtimeChildEntryPath) {
  bootstrapPluginRuntimeChild();
}

function resolveValidatedSandboxRoot(rawSandboxRoot: string): string {
  const workspaceRoot = resolve(process.env.AA_PLUGIN_WORKSPACE_ROOT ?? process.cwd());
  const sandboxBase = resolve(workspaceRoot, "data", "plugin-runtime-sandboxes");
  const candidate = resolve(rawSandboxRoot);
  if (!candidate.startsWith(`${sandboxBase}/`) && candidate !== sandboxBase) {
    throw new Error("plugin_runtime.sandbox_root_outside_workspace");
  }
  if (!existsSync(candidate)) {
    mkdirSync(candidate, { recursive: true });
  }
  const realCandidate = realpathSync(candidate);
  if (!realCandidate.startsWith(`${sandboxBase}/`) && realCandidate !== sandboxBase) {
    throw new Error("plugin_runtime.sandbox_root_symlink_escape");
  }
  if (!statSync(realCandidate).isDirectory()) {
    throw new Error("plugin_runtime.sandbox_root_not_directory");
  }
  return realCandidate;
}
