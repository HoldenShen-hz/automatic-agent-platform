import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { HitlItem } from "../hooks";

export interface HitlMobileCard {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly actionType: "approve" | "reject" | "resume" | "patch" | "override";
  // §210-2506: Add callback handlers for mobile quick actions
  readonly onApprove?: (itemId: string) => Promise<void>;
  readonly onReject?: (itemId: string) => Promise<void>;
  readonly onResume?: (itemId: string) => Promise<void>;
}

/**
 * §210-2506: Root cause - createHitlMobileCards returned static cards without action handlers.
 * Mobile notifications require interactive quick-action handlers to be usable.
 * Fix: Add optional callback parameters for approve/reject/resume actions.
 */
export function createHitlMobileCards(
  items: readonly HitlItem[],
  handlers?: {
    readonly onApprove?: (itemId: string) => Promise<void>;
    readonly onReject?: (itemId: string) => Promise<void>;
    readonly onResume?: (itemId: string) => Promise<void>;
  },
): readonly HitlMobileCard[] {
  const cards: HitlMobileCard[] = [];

  for (const item of items.slice(0, 5)) {
    if (item.type === "approval") {
      cards.push({
        id: `${item.id}:approve`,
        title: `Approve: ${item.title}`,
        description: item.description,
        actionType: "approve",
        onApprove: handlers?.onApprove ? (id) => handlers.onApprove(item.id) : undefined,
        onReject: handlers?.onReject ? (id) => handlers.onReject(item.id) : undefined,
      });
      cards.push({
        id: `${item.id}:reject`,
        title: `Reject: ${item.title}`,
        description: item.description,
        actionType: "reject",
        onApprove: handlers?.onApprove ? (id) => handlers.onApprove(item.id) : undefined,
        onReject: handlers?.onReject ? (id) => handlers.onReject(item.id) : undefined,
      });
    } else if (item.type === "resume") {
      cards.push({
        id: `${item.id}:resume`,
        title: `Resume: ${item.title}`,
        description: item.description,
        actionType: "resume",
        onResume: handlers?.onResume ? (id) => handlers.onResume(item.id) : undefined,
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