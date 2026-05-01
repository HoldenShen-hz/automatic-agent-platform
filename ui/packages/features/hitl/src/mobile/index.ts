import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { HitlItem } from "../hooks";

export interface HitlMobileCard {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly actionType: "approve" | "reject" | "resume" | "patch" | "override";
}

/**
 * Creates interactive HITL cards for mobile notification bar shortcuts.
 * Each card represents a quick action available from the mobile notification.
 */
export function createHitlMobileCards(items: readonly HitlItem[]): readonly HitlMobileCard[] {
  const cards: HitlMobileCard[] = [];

  for (const item of items.slice(0, 5)) {
    if (item.type === "approval") {
      cards.push({
        id: `${item.id}:approve`,
        title: `Approve: ${item.title}`,
        description: item.description,
        actionType: "approve",
      });
      cards.push({
        id: `${item.id}:reject`,
        title: `Reject: ${item.title}`,
        description: item.description,
        actionType: "reject",
      });
    } else if (item.type === "resume") {
      cards.push({
        id: `${item.id}:resume`,
        title: `Resume: ${item.title}`,
        description: item.description,
        actionType: "resume",
      });
    }
  }

  return cards;
}

/**
 * Creates static feature cards for HITL capabilities when no items are present.
 */
export function createHitlFeatureCards(): readonly { title: string; description: string }[] {
  return [
    { title: "Inspect", description: "View current plan and execution state" },
    { title: "Takeover", description: "Manual override with full audit trail" },
    { title: "Resume", description: "Resume in normal/replan/supervised/abort mode" },
    { title: "Patch", description: "Partial modification of workflow context" },
    { title: "Override", description: "Complete replacement of workflow context" },
  ];
}
