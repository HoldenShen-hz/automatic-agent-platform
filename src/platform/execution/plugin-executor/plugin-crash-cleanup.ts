export type PluginCrashResourceKind = "file" | "socket" | "browser" | "secret" | "callback";

export interface PluginCrashResource {
  readonly resourceKind: PluginCrashResourceKind;
  readonly resourceId: string;
}

export interface PluginCrashCleanupRequest {
  readonly pluginId: string;
  readonly runId: string;
  readonly crashedAt: string;
  readonly resources: readonly PluginCrashResource[];
}

export interface PluginCrashCleanupReceipt {
  readonly pluginId: string;
  readonly runId: string;
  readonly cleanupHook: "plugin_crash_cleanup";
  readonly closedResources: readonly PluginCrashResource[];
  readonly secretResourceIds: readonly string[];
  readonly callbacksDetached: number;
  readonly completedAt: string;
}

export class PluginCrashCleanupHook {
  public cleanup(request: PluginCrashCleanupRequest, completedAt = request.crashedAt): PluginCrashCleanupReceipt {
    return {
      pluginId: request.pluginId,
      runId: request.runId,
      cleanupHook: "plugin_crash_cleanup",
      closedResources: [...request.resources],
      secretResourceIds: request.resources
        .filter((resource) => resource.resourceKind === "secret")
        .map((resource) => resource.resourceId),
      callbacksDetached: request.resources.filter((resource) => resource.resourceKind === "callback").length,
      completedAt,
    };
  }
}
