/**
 * Config Hot Reload Service
 *
 * Provides dynamic configuration hot reload capabilities per §24.1:
 * - Subscribes to config.changed events
 * - Watches config files for changes (file-watcher)
 * - Notifies subscribed components to reload their configs
 * - Supports both push and pull reload mechanisms
 */

import { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Severity level for config change notifications.
 */
export type ConfigChangeSeverity = "low" | "medium" | "high" | "critical";

/**
 * Source of the config change.
 */
export type ConfigChangeSource = "file_watcher" | "api" | "event" | "scheduled";

/**
 * Represents a config change event.
 */
export interface ConfigChangeEvent {
  /** Unique change identifier */
  changeId: string;
  /** Config path that changed */
  configPath: string;
  /** Hierarchy layer */
  layer: string;
  /** Source ID if applicable */
  sourceId: string | null;
  /** Source of the change */
  source: ConfigChangeSource;
  /** Severity of the change */
  severity: ConfigChangeSeverity;
  /** When the change occurred */
  timestamp: string;
  /** Version before change */
  previousVersion: string;
  /** Version after change */
  newVersion: string;
}

/**
 * Component subscription to config changes.
 */
export interface ConfigHotReloadSubscription {
  /** Unique subscription ID */
  subscriptionId: string;
  /** Component name for logging */
  componentName: string;
  /** Config paths this subscription cares about (supports wildcards) */
  configPaths: string[];
  /** Layers this subscription cares about */
  layers: string[];
  /** Callback when config changes */
  onConfigChanged: (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => Promise<void>;
  /** Priority (higher = called first) */
  priority: number;
  /** Whether subscription is active */
  active: boolean;
}

/**
 * Options for ConfigHotReloadService.
 */
export interface ConfigHotReloadServiceOptions {
  /** Event bus for subscribing to config.changed events */
  eventBus?: DurableEventBus | null;
  /** File watcher polling interval in ms (default: 5000) */
  fileWatcherIntervalMs?: number;
  /** Enable file watcher (default: true) */
  enableFileWatcher?: boolean;
}

/**
 * Service for hot reloading configuration.
 *
 * Per §24.1:
 * - Subscribes to config.changed events from event bus
 * - Notifies registered components when their configs change
 * - Supports file watching for config file changes
 * - Implements config versioning and change detection
 */
export class ConfigHotReloadService {
  private readonly eventBus: DurableEventBus | null;
  private readonly fileWatcherIntervalMs: number;
  private readonly enableFileWatcher: boolean;

  /** Registered subscriptions */
  private readonly subscriptions = new Map<string, ConfigHotReloadSubscription>();

  /** Known config versions for change detection */
  private readonly configVersions = new Map<string, string>();

  /** File watcher interval handle */
  private fileWatcherHandle: ReturnType<typeof setInterval> | null = null;

  /** Watched config files */
  private readonly watchedFiles = new Set<string>();

  private _initialized = false;

  public constructor(options: ConfigHotReloadServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.fileWatcherIntervalMs = options.fileWatcherIntervalMs ?? 5000;
    this.enableFileWatcher = options.enableFileWatcher ?? true;
  }

  /**
   * Initializes the hot reload service.
   * Must be called before using the service.
   */
  public async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Subscribe to config.changed events from event bus
    if (this.eventBus) {
      await this.eventBus.subscribe(
        "config.changed",
        async (event) => {
          const payload = JSON.parse(event.payloadJson) as { layer: string; sourceId: string | null; previousVersion: string; newVersion: string; [key: string]: unknown };
          await this.handleConfigChangedEvent(payload);
        },
      );
    }

    // Start file watcher if enabled
    if (this.enableFileWatcher) {
      this.startFileWatcher();
    }

    this._initialized = true;
  }

  /**
   * Subscribes a component to config changes.
   *
   * @param componentName - Name of the subscribing component
   * @param configPaths - Config paths to watch (supports * wildcard)
   * @param layers - Hierarchy layers to watch
   * @param onConfigChanged - Callback when config changes
   * @param priority - Higher priority called first (default: 0)
   * @returns Subscription ID
   */
  public subscribe(
    componentName: string,
    configPaths: string[],
    layers: string[],
    onConfigChanged: (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => Promise<void>,
    priority: number = 0,
  ): string {
    const subscriptionId = newId("sub");

    this.subscriptions.set(subscriptionId, {
      subscriptionId,
      componentName,
      configPaths,
      layers,
      onConfigChanged,
      priority,
      active: true,
    });

    return subscriptionId;
  }

  /**
   * Unsubscribes a component from config changes.
   *
   * @param subscriptionId - Subscription ID to remove
   */
  public unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Temporarily pauses a subscription.
   *
   * @param subscriptionId - Subscription ID to pause
   */
  public pauseSubscription(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = false;
    }
  }

  /**
   * Resumes a paused subscription.
   *
   * @param subscriptionId - Subscription ID to resume
   */
  public resumeSubscription(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = true;
    }
  }

  /**
   * Manually triggers a config reload for a specific path.
   *
   * @param configPath - Config path that changed
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @param newConfig - New configuration content
   * @param source - Source of the change
   * @param severity - Severity level
   */
  public async triggerReload(
    configPath: string,
    layer: string,
    sourceId: string | null,
    newConfig: Record<string, unknown>,
    source: ConfigChangeSource = "api",
    severity: ConfigChangeSeverity = "medium",
  ): Promise<void> {
    const previousVersion = this.configVersions.get(configPath) ?? "0";
    const newVersion = this.computeVersion(newConfig);

    const changeEvent: ConfigChangeEvent = {
      changeId: newId("chg"),
      configPath,
      layer,
      sourceId,
      source,
      severity,
      timestamp: nowIso(),
      previousVersion,
      newVersion,
    };

    // Update stored version
    this.configVersions.set(configPath, newVersion);

    // Notify subscribers
    await this.notifySubscribers(changeEvent, newConfig);
  }

  /**
   * Watches a config file for changes.
   *
   * @param filePath - Path to the config file
   */
  public watchFile(filePath: string): void {
    this.watchedFiles.add(filePath);
  }

  /**
   * Stops watching a config file.
   *
   * @param filePath - Path to stop watching
   */
  public unwatchFile(filePath: string): void {
    this.watchedFiles.delete(filePath);
  }

  /**
   * Shuts down the service.
   */
  public shutdown(): void {
    if (this.fileWatcherHandle) {
      clearInterval(this.fileWatcherHandle);
      this.fileWatcherHandle = null;
    }
    this.subscriptions.clear();
    this._initialized = false;
  }

  /**
   * Handles config.changed events from the event bus.
   */
  private async handleConfigChangedEvent(payload: {
    layer: string;
    sourceId: string | null;
    previousVersion: string;
    newVersion: string;
    [key: string]: unknown;
  }): Promise<void> {
    const configPath = (payload["configPath"] as string) ?? "";
    const layer = payload["layer"] as string;
    const sourceId = payload["sourceId"] as string | null;

    // Determine severity based on layer (runtime changes are critical)
    let severity: ConfigChangeSeverity = "medium";
    if (layer === "runtime") {
      severity = "critical";
    } else if (layer === "platform") {
      severity = "low";
    }

    const changeEvent: ConfigChangeEvent = {
      changeId: newId("chg"),
      configPath,
      layer,
      sourceId,
      source: "event",
      severity,
      timestamp: nowIso(),
      previousVersion: payload["previousVersion"] as string,
      newVersion: payload["newVersion"] as string,
    };

    // Update stored version
    this.configVersions.set(configPath, payload["newVersion"] as string);

    // Get new config if available in payload, otherwise signal reload needed
    const newConfig = (payload["newConfig"] as Record<string, unknown>) ?? {};

    await this.notifySubscribers(changeEvent, newConfig);
  }

  /**
   * Notifies all relevant subscribers of a config change.
   */
  private async notifySubscribers(
    change: ConfigChangeEvent,
    newConfig: Record<string, unknown>,
  ): Promise<void> {
    // Get all active subscriptions that match this change
    const matchingSubscribers = Array.from(this.subscriptions.values())
      .filter((sub) => sub.active && this.matchesSubscription(sub, change))
      .sort((a, b) => b.priority - a.priority);

    // Notify in priority order
    for (const subscriber of matchingSubscribers) {
      try {
        await subscriber.onConfigChanged(change, newConfig);
      } catch (error) {
        process.stderr.write(
          `[ConfigHotReload] Subscriber ${subscriber.componentName} failed to handle config change: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
        );
      }
    }
  }

  /**
   * Checks if a subscription matches a config change.
   */
  private matchesSubscription(
    subscription: ConfigHotReloadSubscription,
    change: ConfigChangeEvent,
  ): boolean {
    // Check layer match
    if (!subscription.layers.includes(change.layer) && !subscription.layers.includes("*")) {
      return false;
    }

    // Check config path match (supports wildcards)
    const pathMatches = subscription.configPaths.some((path) => {
      if (path === "*") {
        return true;
      }
      if (path.endsWith("*")) {
        const prefix = path.slice(0, -1);
        return change.configPath.startsWith(prefix);
      }
      return path === change.configPath;
    });

    return pathMatches;
  }

  /**
   * Starts the file watcher polling loop.
   */
  private startFileWatcher(): void {
    if (this.fileWatcherHandle) {
      return;
    }

    this.fileWatcherHandle = setInterval(async () => {
      await this.checkFileChanges();
    }, this.fileWatcherIntervalMs);
  }

  /**
   * Checks for file changes in watched files.
   */
  private async checkFileChanges(): Promise<void> {
    // This is a simplified implementation.
    // In production, this would use fs.watch or a proper file watching mechanism.
    for (const filePath of this.watchedFiles) {
      try {
        // Placeholder for actual file change detection
        // In production: use fs.stat with mtime comparison
        const currentVersion = await this.getFileVersion(filePath);
        const storedVersion = this.configVersions.get(`file:${filePath}`);

        if (storedVersion && currentVersion !== storedVersion) {
          // File changed, trigger reload
          this.configVersions.set(`file:${filePath}`, currentVersion);
          // Note: In production, would read the file and pass the new content
          await this.triggerReload(
            filePath,
            "platform",
            null,
            {},
            "file_watcher",
            "medium",
          );
        }
      } catch {
        // File might not exist yet or be inaccessible
      }
    }
  }

  /**
   * Gets the version of a file based on modification time.
   */
  private async getFileVersion(filePath: string): Promise<string> {
    // Simplified: in production, use fs.stat to get mtime
    return `${filePath}:${Date.now()}`;
  }

  /**
   * Computes a simple version hash from config content.
   */
  private computeVersion(config: Record<string, unknown>): string {
    const str = JSON.stringify(config, Object.keys(config).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}
