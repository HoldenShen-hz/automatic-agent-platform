import type { ReactElement, ReactNode } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel, KeyValueTable, ListCard } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
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

export function ReleaseConsoleWebView(): ReactElement {
  const vm = useReleaseConsoleVm();
  const featureCopy = translateFeatureCopy("release-console");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "release-console-validate", label: "运行门禁", tone: "accent", onTrigger: buildWorkbenchActionHandler("release-console", "validate", { deepLinkPath: "/operations/release-console?mode=validate" }) },
          { id: "release-console-promote", label: "推进灰度", tone: "neutral", onTrigger: buildWorkbenchActionHandler("release-console", "promote", { deepLinkPath: "/operations/release-console?mode=promote" }) },
          { id: "release-console-rollback", label: "查看回滚计划", tone: "danger", onTrigger: buildWorkbenchActionHandler("release-console", "rollback", { copySelection: true, deepLinkPath: "/operations/release-console?view=rollback" }) },
          { id: "release-console-leadership-claims", label: "查看声明治理", tone: "neutral", onTrigger: buildWorkbenchActionHandler("release-console", "leadership-claims", { deepLinkPath: "/operations/release-console/leadership-claims" }) },
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
                    `Owner: ${family.owner}`,
                    `Divisions: ${family.canonicalDivisions.join(", ") || "n/a"}`,
                    `MVP thresholds: ${family.mvpThresholds.map((item) => `${item.label} ${item.requirement}`).join(" / ") || "n/a"}`,
                    `Leadership thresholds: ${family.leadershipThresholds.map((item) => `${item.label} ${item.requirement}`).join(" / ") || "n/a"}`,
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
                    `Expires: ${claim.expiresAt ?? "none"}`,
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
              {vm.leadershipClaims.scannerHits.map((hit) => (
                <GovernanceRow
                  key={`${hit.filePath}:${hit.lineNumber}:${hit.matchedText}`}
                  title={`${hit.status} · ${hit.matchedText}`}
                  status={hit.status}
                  description={`${hit.filePath}:${hit.lineNumber}\n${hit.excerpt}\n${hit.reason ?? "unreviewed"}`}
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
