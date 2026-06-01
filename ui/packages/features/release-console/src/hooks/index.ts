import { startTransition, useEffect, useMemo, useState } from "react";
import type { LeadershipClaimsConsoleDTO } from "@aa/shared-types";
import {
  approveLeadershipClaimReviewRequest,
  fetchLeadershipClaimsConsole,
  rejectLeadershipClaimReviewRequest,
  revokeLeadershipClaim,
} from "@aa/shared-api-client";
import { translateMessage } from "@aa/shared-i18n";
import { useRestClient } from "@aa/shared-state";

export interface ReleaseConsoleVm {
  readonly items: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly mutating: boolean;
  readonly leadershipClaims: LeadershipClaimsConsoleDTO | null;
  readonly summaryRows: readonly { key: string; value: string }[];
  readonly errorMessage: string | null;
  approveReviewRequest(requestId: string): Promise<void>;
  rejectReviewRequest(requestId: string): Promise<void>;
  revokeClaim(claimId: string): Promise<void>;
}

export function useReleaseConsoleVm(): ReleaseConsoleVm {
  const client = useRestClient();
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [leadershipClaims, setLeadershipClaims] = useState<LeadershipClaimsConsoleDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadSnapshot(): Promise<void> {
    const snapshot = await fetchLeadershipClaimsConsole(client);
    startTransition(() => {
      setLeadershipClaims(snapshot);
      setLoading(false);
    });
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void loadSnapshot().then(() => {
      if (mounted) {
        setErrorMessage(null);
      }
    }).catch(() => {
      if (mounted) {
        setLeadershipClaims(null);
        setLoading(false);
        setErrorMessage("leadership_claims.load_failed");
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
    mutating,
    leadershipClaims,
    summaryRows,
    errorMessage,
    approveReviewRequest: async (requestId: string) => {
      setMutating(true);
      setErrorMessage(null);
      try {
        await approveLeadershipClaimReviewRequest(client, requestId, {
          reasonCode: "operator.approved",
        });
        await loadSnapshot();
      } catch {
        setErrorMessage("leadership_claims.approve_failed");
      } finally {
        setMutating(false);
      }
    },
    rejectReviewRequest: async (requestId: string) => {
      setMutating(true);
      setErrorMessage(null);
      try {
        await rejectLeadershipClaimReviewRequest(client, requestId, {
          reasonCode: "operator.rejected",
        });
        await loadSnapshot();
      } catch {
        setErrorMessage("leadership_claims.reject_failed");
      } finally {
        setMutating(false);
      }
    },
    revokeClaim: async (claimId: string) => {
      setMutating(true);
      setErrorMessage(null);
      try {
        await revokeLeadershipClaim(client, claimId, {
          reasonCode: "operator.revoked",
          replacementRequired: true,
        });
        await loadSnapshot();
      } catch {
        setErrorMessage("leadership_claims.revoke_failed");
      } finally {
        setMutating(false);
      }
    },
  };
}
