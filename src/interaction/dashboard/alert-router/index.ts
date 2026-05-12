import type { AttentionItem } from "../index.js";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
} as const;

export function sortAttentionQueue(items: readonly AttentionItem[]): AttentionItem[] {
  return [...items].sort((left, right) => {
    const byPriority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (byPriority !== 0) {
      return byPriority;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export type NotificationDeliveryType = "overlay" | "push" | "haptic" | "email" | "sms";

export interface AlertNotificationRoute {
  readonly item: AttentionItem;
  readonly delivery: NotificationDeliveryType;
  readonly reason: string;
}

export interface AlertRouterOptions {
  readonly enableOverlay?: boolean;
  readonly enablePush?: boolean;
  readonly enableHaptic?: boolean;
  readonly cooldownMs?: number;
  readonly now?: () => number;
}

export class AlertRouter {
  private readonly now: () => number;
  private readonly cooldownMs: number;
  private readonly lastDeliveryAt = new Map<string, number>();

  public constructor(private readonly options: AlertRouterOptions = {}) {
    this.now = options.now ?? Date.now;
    this.cooldownMs = options.cooldownMs ?? 30_000;
  }

  public routeNotifications(items: readonly AttentionItem[]): AlertNotificationRoute[] {
    return this.collectRoutes(items, true);
  }

  public getOverlayAlerts(items: readonly AttentionItem[]): AttentionItem[] {
    return this.collectRoutes(items, false)
      .filter((route) => route.delivery === "overlay")
      .map((route) => route.item);
  }

  public getPushNotifications(items: readonly AttentionItem[]): AttentionItem[] {
    return this.collectRoutes(items, false)
      .filter((route) => route.delivery === "push")
      .map((route) => route.item);
  }

  public getHapticAlerts(items: readonly AttentionItem[]): AttentionItem[] {
    return this.collectRoutes(items, false)
      .filter((route) => route.delivery === "haptic")
      .map((route) => route.item);
  }

  private collectRoutes(items: readonly AttentionItem[], applyCooldown: boolean): AlertNotificationRoute[] {
    const routes: AlertNotificationRoute[] = [];
    for (const item of sortAttentionQueue(items)) {
      for (const delivery of this.resolveDeliveries(item)) {
        if (applyCooldown && this.isCoolingDown(item.id, delivery)) {
          continue;
        }
        if (applyCooldown) {
          this.lastDeliveryAt.set(this.getCooldownKey(item.id, delivery), this.now());
        }
        routes.push({
          item,
          delivery,
          reason: `${item.itemType}:${item.priority}`,
        });
      }
    }
    return routes;
  }

  private resolveDeliveries(item: AttentionItem): NotificationDeliveryType[] {
    const deliveries: NotificationDeliveryType[] = [];
    const overlayEnabled = this.options.enableOverlay ?? true;
    const pushEnabled = this.options.enablePush ?? true;
    const hapticEnabled = this.options.enableHaptic ?? true;

    if (overlayEnabled) {
      deliveries.push("overlay");
    }
    if (pushEnabled && (item.priority === "critical" || item.priority === "high")) {
      deliveries.push("push");
    }
    if (hapticEnabled && (item.itemType === "approval_needed" || item.priority === "critical")) {
      deliveries.push("haptic");
    }
    return deliveries;
  }

  private isCoolingDown(itemId: string, delivery: NotificationDeliveryType): boolean {
    const lastDeliveryAt = this.lastDeliveryAt.get(this.getCooldownKey(itemId, delivery));
    return lastDeliveryAt != null && this.now() - lastDeliveryAt < this.cooldownMs;
  }

  private getCooldownKey(itemId: string, delivery: NotificationDeliveryType): string {
    return `${itemId}:${delivery}`;
  }
}
