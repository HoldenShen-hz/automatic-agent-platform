import { createElement, type ReactElement } from "react";
import type { SystemStatusVM } from "@aa/shared-types";
import { designTokens } from "../design-tokens";

function StatusChip({ label, value, accent }: { label: string; value: string; accent?: string }): ReactElement {
  return createElement(
    "div",
    { style: { border: `1px solid ${designTokens.color.border}`, borderRadius: 999, padding: "6px 10px", color: designTokens.color.text, background: "#0b1325" } },
    createElement("span", { style: { color: designTokens.color.subtle, marginRight: 8 } }, label),
    createElement("strong", { style: { color: accent ?? designTokens.color.text } }, value),
  );
}

export function SystemStatusBar({ status }: { status: SystemStatusVM }): ReactElement {
  return createElement(
    "div",
    { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 } },
    createElement(StatusChip, { label: "WS", value: status.wsStatus }),
    createElement(StatusChip, { label: "Offline Queue", value: String(status.offlineQueueSize) }),
    createElement(StatusChip, { label: "Sync", value: status.syncStatus }),
    createElement(StatusChip, {
      label: "Panic",
      value: status.panicActivated ? "active" : "normal",
      accent: status.panicActivated ? designTokens.color.danger : designTokens.color.accent,
    }),
  );
}

export function createSystemHealthSummary(status: SystemStatusVM): readonly { label: string; value: string }[] {
  return [
    { label: "WS", value: status.wsStatus },
    { label: "Offline Queue", value: String(status.offlineQueueSize) },
    { label: "Sync", value: status.syncStatus },
    { label: "Panic", value: status.panicActivated ? "active" : "normal" },
  ] as const;
}
