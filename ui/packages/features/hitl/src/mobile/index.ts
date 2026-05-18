import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { HitlItem } from "../hooks";

type HitlMobileCard = ReturnType<typeof createMobileFeatureCard> & {
  readonly id: string;
  onApprove(): Promise<void>;
  onReject(): Promise<void>;
  onResume(): Promise<void>;
};

export function createHitlMobileCards(
  items: readonly HitlItem[] = [],
  handlers?: {
    onApprove?(id: string): Promise<void> | void;
    onReject?(id: string): Promise<void> | void;
    onResume?(id: string): Promise<void> | void;
  },
) : readonly HitlMobileCard[] {
  const cards: HitlMobileCard[] = [];
  for (const item of items.slice(0, 5)) {
    if (item.type === "approval") {
      cards.push({
        id: `${item.id}:approve`,
        ...createMobileFeatureCard(item.title, item.description, "approve"),
        async onApprove() {
          await handlers?.onApprove?.(item.id);
        },
        async onReject() {},
        async onResume() {},
      });
      cards.push({
        id: `${item.id}:reject`,
        ...createMobileFeatureCard(item.title, item.description, "reject"),
        async onApprove() {},
        async onReject() {
          await handlers?.onReject?.(item.id);
        },
        async onResume() {},
      });
      continue;
    }

    cards.push({
      id: `${item.id}:resume`,
      ...createMobileFeatureCard(item.title, item.description, "resume"),
      async onApprove() {},
      async onReject() {},
      async onResume() {
        await handlers?.onResume?.(item.id);
      },
    });
  }
  return cards;
}
