import type { AttentionItem } from "../index.js";

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
} as const;

// UI spec notification delivery mechanisms
export type NotificationDeliveryType = "overlay" | "push" | "haptic" | "email" | "sms" | "nl_summary";

export interface NotificationRoutingRule {
  readonly alertType: AttentionItem["itemType"];
  readonly priority: AttentionItem["priority"];
  readonly deliveryMethods: readonly NotificationDeliveryType[];
  readonly targetChannel?: string;
  readonly cooldownSeconds?: number;
}

export interface RoutedNotification {
  readonly item: AttentionItem;
  readonly deliveryType: NotificationDeliveryType;
  readonly routedAt: string;
  readonly targetEndpoint: string;
}

export interface AlertRouterConfig {
  readonly rules: readonly NotificationRoutingRule[];
  readonly enableOverlay: boolean;
  readonly enablePush: boolean;
  readonly enableHaptic: boolean;
  readonly enableNlSummary: boolean;
}

export interface NlSummaryDigestItem {
  readonly itemType: AttentionItem["itemType"];
  readonly priority: AttentionItem["priority"];
  readonly title: string;
  readonly domainId: string;
  readonly actionOptions: readonly string[];
}

export interface NlSummaryDigest {
  readonly generatedAt: string;
  readonly summaryText: string;
  readonly items: readonly NlSummaryDigestItem[];
}

const DEFAULT_ROUTING_RULES: readonly NotificationRoutingRule[] = [
  { alertType: "incident", priority: "critical", deliveryMethods: ["overlay", "push", "haptic", "email", "sms"], cooldownSeconds: 60 },
  { alertType: "incident", priority: "high", deliveryMethods: ["overlay", "push"], cooldownSeconds: 120 },
  { alertType: "approval_needed", priority: "high", deliveryMethods: ["push", "overlay", "email", "sms"], cooldownSeconds: 60 },
  { alertType: "approval_needed", priority: "normal", deliveryMethods: ["push"], cooldownSeconds: 300 },
  { alertType: "budget_warning", priority: "high", deliveryMethods: ["overlay", "push"], cooldownSeconds: 180 },
  { alertType: "budget_warning", priority: "normal", deliveryMethods: ["push"], cooldownSeconds: 600 },
  { alertType: "quality_alert", priority: "high", deliveryMethods: ["push", "overlay"], cooldownSeconds: 120 },
  { alertType: "suggestion", priority: "normal", deliveryMethods: ["push"], cooldownSeconds: 900 },
  { alertType: "suggestion", priority: "low", deliveryMethods: [], cooldownSeconds: 1800 },
];

const DEFAULT_CONFIG: AlertRouterConfig = {
  rules: DEFAULT_ROUTING_RULES,
  enableOverlay: true,
  enablePush: true,
  enableHaptic: true,
  enableNlSummary: true,
};

export function sortAttentionQueue(items: readonly AttentionItem[]): AttentionItem[] {
  return [...items].sort((left, right) => {
    const priorityDiff = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

/**
 * Alert Router Service
 *
 * Provides real-time routing, overlay, push, and haptic notification delivery
 * per UI spec requirements.
 */
export class AlertRouter {
  private readonly config: AlertRouterConfig;
  private readonly deliveryHistory = new Map<string, { lastDeliveredAt: string; count: number }>();

  public constructor(config?: Partial<AlertRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Route attention items to appropriate notification channels.
   * Returns notifications to be delivered based on routing rules.
   */
  public routeNotifications(items: readonly AttentionItem[]): readonly RoutedNotification[] {
    const now = new Date().toISOString();
    const routed: RoutedNotification[] = [];

    for (const item of items) {
      const rule = this.findMatchingRule(item);
      if (!rule) continue;

      for (const deliveryType of rule.deliveryMethods) {
        if (!this.shouldDeliver(item, deliveryType, rule.cooldownSeconds ?? 300)) continue;

        routed.push({
          item,
          deliveryType,
          routedAt: now,
          targetEndpoint: this.resolveTargetEndpoint(item, deliveryType),
        });

        this.recordDelivery(item, deliveryType, now);
      }
    }

    return routed;
  }

  /**
   * Filter items that should show overlay notification.
   */
  public getOverlayAlerts(items: readonly AttentionItem[]): readonly AttentionItem[] {
    if (!this.config.enableOverlay) return [];
    return items.filter((item) => {
      const rule = this.findMatchingRule(item);
      return rule?.deliveryMethods.includes("overlay") ?? false;
    });
  }

  /**
   * Filter items that should trigger push notification.
   */
  public getPushNotifications(items: readonly AttentionItem[]): readonly AttentionItem[] {
    if (!this.config.enablePush) return [];
    return items.filter((item) => {
      const rule = this.findMatchingRule(item);
      return rule?.deliveryMethods.includes("push") ?? false;
    });
  }

  /**
   * Filter items that should trigger haptic feedback.
   */
  public getHapticAlerts(items: readonly AttentionItem[]): readonly AttentionItem[] {
    if (!this.config.enableHaptic) return [];
    return items.filter((item) => {
      const rule = this.findMatchingRule(item);
      return rule?.deliveryMethods.includes("haptic") ?? false;
    });
  }

  /**
   * Filter items that should trigger email notification.
   */
  public getEmailNotifications(items: readonly AttentionItem[]): readonly AttentionItem[] {
    return items.filter((item) => {
      const rule = this.findMatchingRule(item);
      return rule?.deliveryMethods.includes("email") ?? false;
    });
  }

  /**
   * Filter items that should trigger SMS alert.
   */
  public getSmsAlerts(items: readonly AttentionItem[]): readonly AttentionItem[] {
    return items.filter((item) => {
      const rule = this.findMatchingRule(item);
      return rule?.deliveryMethods.includes("sms") ?? false;
    });
  }

  /**
   * Build a compact NL summary feed so dashboards and chat surfaces can
   * surface attention items through a third channel besides overlay/push.
   */
  public buildNlSummary(items: readonly AttentionItem[], limit = 3): NlSummaryDigest | null {
    if (!this.config.enableNlSummary || items.length === 0) {
      return null;
    }

    const prioritizedItems = sortAttentionQueue(items).slice(0, Math.max(1, limit));
    const digestItems = prioritizedItems.map((item) => ({
      itemType: item.itemType,
      priority: item.priority,
      title: item.title,
      domainId: item.domainId,
      actionOptions: [...(item.actionOptions ?? [])],
    }));

    const summaryText = digestItems
      .map((item) => `[${item.priority}] ${item.title} (${item.itemType} @ ${item.domainId})`)
      .join("; ");

    return {
      generatedAt: new Date().toISOString(),
      summaryText,
      items: digestItems,
    };
  }

  /**
   * Check if an item should be delivered (respects cooldown).
   */
  private shouldDeliver(item: AttentionItem, deliveryType: NotificationDeliveryType, cooldownSeconds: number): boolean {
    const key = this.makeDeliveryKey(item, deliveryType);
    const history = this.deliveryHistory.get(key);

    if (!history) return true;

    const lastDelivered = new Date(history.lastDeliveredAt).getTime();
    const now = Date.now();
    return now - lastDelivered >= cooldownSeconds * 1000;
  }

  /**
   * Record a delivery for cooldown tracking.
   */
  private recordDelivery(item: AttentionItem, deliveryType: NotificationDeliveryType, timestamp: string): void {
    const key = this.makeDeliveryKey(item, deliveryType);
    const existing = this.deliveryHistory.get(key);
    this.deliveryHistory.set(key, {
      lastDeliveredAt: timestamp,
      count: (existing?.count ?? 0) + 1,
    });
  }

  /**
   * Find the matching routing rule for an attention item.
   */
  private findMatchingRule(item: AttentionItem): NotificationRoutingRule | undefined {
    return this.config.rules.find(
      (rule) => rule.alertType === item.itemType && rule.priority === item.priority,
    );
  }

  /**
   * Resolve the target endpoint for a notification.
   */
  private resolveTargetEndpoint(item: AttentionItem, deliveryType: NotificationDeliveryType): string {
    switch (deliveryType) {
      case "overlay":
        return `overlay://${item.domainId}/${item.itemType}`;
      case "push":
        return `push://tenant/${item.domainId}`;
      case "haptic":
        return `haptic://device/${item.domainId}`;
      case "email":
        return `email://domain/${item.domainId}`;
      case "sms":
        return `sms://domain/${item.domainId}`;
      case "nl_summary":
        return `summary://tenant/${item.domainId}`;
      default:
        return `unknown://${item.domainId}`;
    }
  }

  private makeDeliveryKey(item: AttentionItem, deliveryType: NotificationDeliveryType): string {
    return `${item.itemType}:${item.priority}:${deliveryType}`;
  }
}
