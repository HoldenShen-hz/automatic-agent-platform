import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel, KeyValueTable, ListCard } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useReleaseConsoleVm } from "../hooks";

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
        <div>
          <h3>{translateMessage("ui.releaseConsole.summary.title")}</h3>
          {vm.loading ? <p>{translateMessage("ui.releaseConsole.loading")}</p> : <KeyValueTable rows={vm.summaryRows} />}
        </div>
        {vm.leadershipClaims != null ? (
          <ListCard items={vm.leadershipClaims.families.map((family) => ({
            title: family.displayName,
            description: `${family.readinessStatus} / ${family.targetClaimLevel} / ${family.owner}`,
          }))} />
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
          <div>
            <h3>{translateMessage("ui.releaseConsole.summary.title")}</h3>
            <KeyValueTable rows={vm.summaryRows} />
          </div>
          <div>
            <h3>{translateMessage("ui.releaseConsole.claims.families")}</h3>
            <ListCard items={vm.leadershipClaims.families.map((family) => ({
              title: `${family.displayName} · ${family.readinessStatus}`,
              description: `${family.targetClaimLevel} / ${family.canonicalDivisions.join(", ")}`,
            }))} />
          </div>
          <div>
            <h3>{translateMessage("ui.releaseConsole.claims.records")}</h3>
            <ListCard items={vm.leadershipClaims.claims.map((claim) => ({
              title: `${claim.familyId} · ${claim.claimLevel} · ${claim.effectiveStatus}`,
              description: claim.claimText,
            }))} />
          </div>
          <div>
            <h3>{translateMessage("ui.releaseConsole.claims.scannerHits")}</h3>
            <ListCard items={vm.leadershipClaims.scannerHits.map((hit) => ({
              title: `${hit.status} · ${hit.matchedText}`,
              description: `${hit.filePath}:${hit.lineNumber} · ${hit.reason ?? "unreviewed"}`,
            }))} />
          </div>
          <div>
            <h3>{translateMessage("ui.releaseConsole.claims.reviewRequests")}</h3>
            <ListCard items={vm.leadershipClaims.reviewRequests.map((request) => ({
              title: `${request.familyId} · ${request.requestedClaimLevel} · ${request.status}`,
              description: `${request.requestedBy} / ${request.rationale}`,
            }))} />
          </div>
          <div>
            <h3>{translateMessage("ui.releaseConsole.claims.noGoActions")}</h3>
            <ListCard items={vm.leadershipClaims.noGoActions.map((action) => ({
              title: `${action.id} · ${action.riskClass}`,
              description: `${action.description} / ${action.blockModes.join(", ")}`,
            }))} />
          </div>
        </div>
      )}
    </FeatureScaffold>
  );
}
