import { translateMessage } from "@aa/shared-i18n";

export interface ReleaseConsoleVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useReleaseConsoleVm(): ReleaseConsoleVm {
  return {
    items: [
      {
        title: translateMessage("ui.releaseConsole.item.manifest.title"),
        description: translateMessage("ui.releaseConsole.item.manifest.description"),
      },
      {
        title: translateMessage("ui.releaseConsole.item.stableGate.title"),
        description: translateMessage("ui.releaseConsole.item.stableGate.description"),
      },
      {
        title: translateMessage("ui.releaseConsole.item.promotion.title"),
        description: translateMessage("ui.releaseConsole.item.promotion.description"),
      },
    ],
  };
}
