import { useEffect, useMemo, useState } from "react";
import type { LeadershipClaimsConsoleDTO } from "@aa/shared-types";
import { fetchLeadershipClaimsConsole } from "@aa/shared-api-client";
import { translateMessage } from "@aa/shared-i18n";
import { useRestClient } from "@aa/shared-state";

export interface ReleaseConsoleVm {
  readonly items: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly leadershipClaims: LeadershipClaimsConsoleDTO | null;
  readonly summaryRows: readonly { key: string; value: string }[];
}

export function useReleaseConsoleVm(): ReleaseConsoleVm {
  const client = useRestClient();
  const [loading, setLoading] = useState(true);
  const [leadershipClaims, setLeadershipClaims] = useState<LeadershipClaimsConsoleDTO | null>(null);

  useEffect(() => {
    let mounted = true;
    void fetchLeadershipClaimsConsole(client).then((snapshot) => {
      if (mounted) {
        setLeadershipClaims(snapshot);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setLeadershipClaims(null);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [client]);

  const summaryRows = useMemo(() => leadershipClaims == null
    ? []
    : [
      { key: translateMessage("ui.releaseConsole.summary.families"), value: String(leadershipClaims.summary.familyCount) },
      { key: translateMessage("ui.releaseConsole.summary.approvedClaims"), value: String(leadershipClaims.summary.approvedClaimCount) },
      { key: translateMessage("ui.releaseConsole.summary.pendingReviews"), value: String(leadershipClaims.summary.pendingReviewRequestCount) },
      { key: translateMessage("ui.releaseConsole.summary.blockedHits"), value: String(leadershipClaims.summary.blockedScannerHitCount) },
    ], [leadershipClaims]);

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
    loading,
    leadershipClaims,
    summaryRows,
  };
}
