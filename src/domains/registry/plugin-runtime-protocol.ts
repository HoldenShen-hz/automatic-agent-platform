import { z } from "zod";

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

export const PluginRuntimeRequestSchema = z.object({
  type: z.literal("request"),
  requestId: z.string().min(1),
  pluginId: z.string().min(1),
  action: z.enum(["load", "activate", "health_check", "deactivate", "unload", "retrieve", "present", "authenticate", "execute"]),
  context: z.unknown().nullable(),
  input: z.unknown().optional(),
});

export const PluginRuntimeShutdownRequestSchema = z.object({
  type: z.literal("shutdown"),
});

export const PluginRuntimeReadyMessageSchema = z.object({
  type: z.literal("ready"),
  pid: z.number().int().positive(),
});

export const PluginRuntimeResponseSchema = z.object({
  type: z.literal("response"),
  requestId: z.string().min(1),
  ok: z.boolean(),
  pid: z.number().int().positive(),
  result: z.unknown().optional(),
  error: z.object({
    name: z.string().min(1),
    message: z.string().min(1),
  }).optional(),
}).superRefine((value, ctx) => {
  if (value.ok && value.error != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "successful responses cannot include error payloads",
    });
  }
  if (!value.ok && value.error == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "failed responses must include error payloads",
    });
  }
});

export const PluginRuntimeMessageSchema = z.union([
  PluginRuntimeReadyMessageSchema,
  PluginRuntimeResponseSchema,
]);

export const PluginRuntimeChildMessageSchema = z.union([
  PluginRuntimeRequestSchema,
  PluginRuntimeShutdownRequestSchema,
]);

export function parsePluginRuntimeMessage(message: unknown): PluginRuntimeMessage {
  return PluginRuntimeMessageSchema.parse(message) as PluginRuntimeMessage;
}

export function parsePluginRuntimeChildMessage(message: unknown): PluginRuntimeChildMessage {
  return PluginRuntimeChildMessageSchema.parse(message) as PluginRuntimeChildMessage;
}
