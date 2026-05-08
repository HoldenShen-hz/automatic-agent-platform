import type { PluginLifecycleContext } from "./plugin-spi.js";

export type PluginRuntimeAction =
  | "load"
  | "activate"
  | "health_check"
  | "deactivate"
  | "unload"
  | "retrieve"
  | "present"
  | "authenticate"
  | "execute";

export interface PluginRuntimeRequest {
  type: "request";
  requestId: string;
  pluginId: string;
  action: PluginRuntimeAction;
  context: PluginLifecycleContext | null;
  input?: unknown;
}

export interface PluginRuntimeShutdownRequest {
  type: "shutdown";
}

export interface PluginRuntimeReadyMessage {
  type: "ready";
  pid: number;
}

export interface PluginRuntimeResponse {
  type: "response";
  requestId: string;
  ok: boolean;
  pid: number;
  result?: unknown;
  error?: {
    name: string;
    message: string;
  };
}

export type PluginRuntimeMessage = PluginRuntimeReadyMessage | PluginRuntimeResponse;
export type PluginRuntimeChildMessage = PluginRuntimeRequest | PluginRuntimeShutdownRequest;
