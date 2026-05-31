import { translateMessage } from "@aa/shared-i18n";

export interface AuditVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useAuditVm(): AuditVm {
  return {
    items: [
      {
        title: translateMessage("ui.audit.item.timeline.title"),
        description: translateMessage("ui.audit.item.timeline.description"),
      },
      {
        title: translateMessage("ui.audit.item.evidence.title"),
        description: translateMessage("ui.audit.item.evidence.description"),
      },
      {
        title: translateMessage("ui.audit.item.actor.title"),
        description: translateMessage("ui.audit.item.actor.description"),
      },
    ],
  };
}
