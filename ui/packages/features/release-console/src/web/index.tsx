import type { ReactElement, ReactNode } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel, KeyValueTable, ListCard } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { copyTextToClipboard } from "@aa/shared-platform";
import { useReleaseConsoleVm } from "../hooks";

function statusTone(status: string): string {
  if (status === "revoked" || status === "expired" || status === "blocked" || status === "expired_allowlist" || status === "rejected") {
    return "#9f1239";
  }
  if (status === "pending" || status === "partial") {
    return "#92400e";
  }
  return "#166534";
}

function GovernanceSection(props: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #d6d3d1", borderRadius: 12, background: "#fffdf8" }}>
      <h3 style={{ margin: 0 }}>{props.title}</h3>
      {props.children}
    </section>
  );
}

function GovernanceRow(props: {
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly action?: ReactNode;
}): ReactElement {
  return (
    <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 10, background: "#ffffff", border: "1px solid #e7e5e4" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <strong>{props.title}</strong>
        <span style={{ color: statusTone(props.status), fontWeight: 700 }}>{props.status}</span>
      </div>
      <div style={{ color: "#44403c", whiteSpace: "pre-wrap" }}>{props.description}</div>
      {props.action ?? null}
    </div>
  );
}

function buildScannerHitKey(
  hit: {
    readonly filePath: string;
    readonly lineNumber: number;
    readonly matchedText: string;
  },
  index: number,
): string {
  return `${hit.filePath}:${hit.lineNumber}:${hit.matchedText}:${index}`;
}

function buildAllowlistKey(
  entry: {
    readonly filePath: string;
    readonly matchedText: string;
    readonly owner: string;
    readonly expiresAt: string | null;
  },
  index: number,
): string {
  return `${entry.filePath}:${entry.matchedText}:${entry.owner}:${entry.expiresAt ?? "none"}:${index}`;
}

export function ReleaseConsoleWebView(): ReactElement {
  const vm = useReleaseConsoleVm();
  const featureCopy = translateFeatureCopy("release-console");

  async function copySummary(): Promise<void> {
    const summary = vm.summaryRows.map((row) => `${row.key}: ${row.value}`).join("\n");
    await copyTextToClipboard(summary);
  }

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items.map((item) => ({ ...item, detailRows: [] }))}
        actions={[
          { id: "release-console-refresh", label: "刷新治理快照", tone: "accent", onTrigger: () => vm.refresh(), activityDescription: "已从真实后端刷新发布治理快照。" },
          { id: "release-console-copy", label: "复制治理摘要", tone: "neutral", disabled: vm.summaryRows.length === 0, onTrigger: () => copySummary(), activityDescription: "已复制当前发布治理摘要。" },
          { id: "release-console-leadership-claims", label: "查看声明治理", tone: "neutral", onTrigger: buildWorkbenchActionHandler("release-console", "leadership-claims", { deepLinkPath: "/operations/release-console/leadership-claims" }), activityDescription: "已跳转到真实声明治理页面。" },
        ]}
      />
      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        <GovernanceSection title={translateMessage("ui.releaseConsole.summary.title")}>
          {vm.loading ? <p>{translateMessage("ui.releaseConsole.loading")}</p> : <KeyValueTable rows={vm.summaryRows} />}
        </GovernanceSection>
        {vm.leadershipClaims != null ? (
          <GovernanceSection title="Family readiness">
            <ListCard items={vm.leadershipClaims.families.map((family) => ({
              title: family.displayName,
              description: `${family.readinessStatus} / ${family.targetClaimLevel} / ${family.owner}`,
            }))} />
          </GovernanceSection>
        ) : null}
      </div>
    </FeatureScaffold>
  );
}

export function LeadershipClaimsWebView(): ReactElement {
  const vm = useReleaseConsoleVm();
  const featureCopy = translateFeatureCopy("release-console");
  return (
    <FeatureScaffold title={translateMessage("ui.releaseConsole.claims.title")} summary={featureCopy.summary} status="Implemented/Internal">
      {vm.loading || vm.leadershipClaims == null ? (
        <p>{translateMessage("ui.releaseConsole.loading")}</p>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          <GovernanceSection title={translateMessage("ui.releaseConsole.summary.title")}>
            <KeyValueTable rows={vm.summaryRows} />
            {vm.errorMessage != null ? <p style={{ color: "#9f1239", margin: 0 }}>{vm.errorMessage}</p> : null}
          </GovernanceSection>

          <GovernanceSection title="Family readiness">
            <div style={{ display: "grid", gap: 12 }}>
              {vm.leadershipClaims.families.map((family) => (
                <GovernanceRow
                  key={family.familyId}
                  title={`${family.displayName} · ${family.readinessStatus}`}
                  status={family.targetClaimLevel}
                  description={[
                    `Owner: ${family.owner} / Claim review owner: ${family.familyPolicy.claimReviewOwner}`,
                    `Target claim: ${family.targetClaimLevel}`,
                    `Leadership types: ${family.familyPolicy.leadershipTypes.join(", ") || "n/a"}`,
                    `Divisions: ${family.canonicalDivisions.join(", ") || "n/a"}`,
                    `MVP thresholds: ${family.mvpThresholds.map((item) => `${item.label} ${item.requirement}`).join(" / ") || "n/a"}`,
                    `Leadership thresholds: ${family.leadershipThresholds.map((item) => `${item.label} ${item.requirement}`).join(" / ") || "n/a"}`,
                    `No-go boundary: ${family.familyPolicy.noGoBoundaryRef ?? "n/a"}`,
                  ].join("\n")}
                />
              ))}
            </div>
          </GovernanceSection>

          <GovernanceSection title="Claim records">
            <div style={{ display: "grid", gap: 12 }}>
              {vm.leadershipClaims.claims.map((claim) => (
                <GovernanceRow
                  key={claim.claimId}
                  title={`${claim.familyId} · ${claim.claimLevel} · ${claim.effectiveStatus}`}
                  status={claim.effectiveStatus}
                  description={[
                    claim.claimText,
                    `Evidence: ${claim.evidenceRefs.join(", ") || "n/a"}`,
                    `Owner: ${claim.owner ?? "n/a"} / Requested by: ${claim.requestedBy ?? "n/a"}`,
                    `Submitted: ${claim.submittedAt ?? "n/a"}`,
                    `Expires: ${claim.expiresAt ?? "none"}`,
                    `Freshness: ${claim.freshnessStatus}`,
                    `Reason: ${claim.effectiveStatusReasonCode ?? "n/a"}`,
                    `Revoked by: ${claim.revokedBy ?? "n/a"}`,
                  ].join("\n")}
                  action={
                    claim.effectiveStatus === "approved" ? (
                      <button type="button" disabled={vm.mutating} onClick={() => void vm.revokeClaim(claim.claimId)}>
                        Revoke claim
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </GovernanceSection>

          <GovernanceSection title="Scanner hits">
            <div style={{ display: "grid", gap: 12 }}>
              {vm.leadershipClaims.scannerHits.map((hit, index) => (
                <GovernanceRow
                  key={buildScannerHitKey(hit, index)}
                  title={`${hit.status} · ${hit.matchedText}`}
                  status={hit.status}
                  description={`${hit.filePath}:${hit.lineNumber}\n${hit.excerpt}\n${hit.reason ?? "unreviewed"}`}
                />
              ))}
            </div>
          </GovernanceSection>

          <GovernanceSection title="Allowlist entries">
            <div style={{ display: "grid", gap: 12 }}>
              {vm.leadershipClaims.allowlist.map((entry, index) => (
                <GovernanceRow
                  key={buildAllowlistKey(entry, index)}
                  title={`${entry.expired ? "expired_allowlist" : "allowlist"} · ${entry.matchedText}`}
                  status={entry.expired ? "expired_allowlist" : "allowlisted"}
                  description={[
                    `${entry.filePath}`,
                    `Owner: ${entry.owner}`,
                    `Claim level: ${entry.claimLevel ?? "n/a"} / Surface: ${entry.surface ?? "n/a"}`,
                    `Expires: ${entry.expiresAt ?? "n/a"}`,
                    `Replacement: ${entry.replacementSuggestion ?? "n/a"}`,
                    `Reason: ${entry.reason}`,
                  ].join("\n")}
                />
              ))}
            </div>
          </GovernanceSection>

          <GovernanceSection title="Review requests">
            <div style={{ display: "grid", gap: 12 }}>
              {vm.leadershipClaims.reviewRequests.map((request) => (
                <GovernanceRow
                  key={request.requestId}
                  title={`${request.familyId} · ${request.requestedClaimLevel} · ${request.status}`}
                  status={request.status}
                  description={[
                    `${request.requestedBy} / ${request.rationale}`,
                    `Surfaces: ${request.requestedSurfaces.join(", ")}`,
                    `Evidence: ${request.evidenceRefs.join(", ") || "n/a"}`,
                    `Decision: ${request.decisionReasonCode ?? "pending"}`,
                  ].join("\n")}
                  action={
                    request.status === "pending" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" disabled={vm.mutating} onClick={() => void vm.approveReviewRequest(request.requestId)}>
                          Approve review
                        </button>
                        <button type="button" disabled={vm.mutating} onClick={() => void vm.rejectReviewRequest(request.requestId)}>
                          Reject review
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </GovernanceSection>

          <GovernanceSection title="No-go actions">
            <div style={{ display: "grid", gap: 12 }}>
              {vm.leadershipClaims.noGoActions.map((action) => (
                <GovernanceRow
                  key={`${action.familyId ?? "global"}:${action.id}`}
                  title={`${action.id} · ${action.riskClass}`}
                  status={action.familyId ?? "global"}
                  description={[
                    action.description,
                    `Scopes: ${action.scopes.join(", ") || "n/a"}`,
                    `Surfaces: ${action.enforcementSurfaces.join(", ") || "n/a"}`,
                    `Block modes: ${action.blockModes.join(", ") || "n/a"}`,
                    `Sources: ${action.sources.join(", ") || "n/a"}`,
                  ].join("\n")}
                />
              ))}
            </div>
          </GovernanceSection>
        </div>
      )}
    </FeatureScaffold>
  );
}
