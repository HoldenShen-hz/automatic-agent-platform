import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { HitlItem } from "../hooks";

export function createHitlMobileCards(
  items: readonly HitlItem[] = [],
  handlers?: {
    onApprove?(id: string): Promise<void> | void;
    onReject?(id: string): Promise<void> | void;
    onResume?(id: string): Promise<void> | void;
  },
) {
  return items.slice(0, 5).flatMap((item) => {
    if (item.type === "approval") {
      return [
        {
          id: `${item.id}:approve`,
          ...createMobileFeatureCard(item.title, item.description, "approve"),
          async onApprove() {
            await handlers?.onApprove?.(item.id);
          },
        },
        {
          id: `${item.id}:reject`,
          ...createMobileFeatureCard(item.title, item.description, "reject"),
          async onReject() {
            await handlers?.onReject?.(item.id);
          },
        },
      ];
    }

    return [
      {
        id: `${item.id}:resume`,
        ...createMobileFeatureCard(item.title, item.description, "resume"),
        async onResume() {
          await handlers?.onResume?.(item.id);
        },
      },
    ];
  });
}
