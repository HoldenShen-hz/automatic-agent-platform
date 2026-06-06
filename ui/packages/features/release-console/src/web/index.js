import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel, KeyValueTable, ListCard } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { copyTextToClipboard } from "@aa/shared-platform";
import { useReleaseConsoleVm } from "../hooks";
function statusTone(status) {
    if (status === "revoked" || status === "expired" || status === "blocked" || status === "expired_allowlist" || status === "rejected") {
        return "#9f1239";
    }
    if (status === "pending" || status === "partial") {
        return "#92400e";
    }
    return "#166534";
}
function GovernanceSection(props) {
    return (_jsxs("section", { style: { display: "grid", gap: 12, padding: 16, border: "1px solid #d6d3d1", borderRadius: 12, background: "#fffdf8" }, children: [_jsx("h3", { style: { margin: 0 }, children: props.title }), props.children] }));
}
function GovernanceRow(props) {
    return (_jsxs("div", { style: { display: "grid", gap: 8, padding: 12, borderRadius: 10, background: "#ffffff", border: "1px solid #e7e5e4" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }, children: [_jsx("strong", { children: props.title }), _jsx("span", { style: { color: statusTone(props.status), fontWeight: 700 }, children: props.status })] }), _jsx("div", { style: { color: "#44403c", whiteSpace: "pre-wrap" }, children: props.description }), props.action ?? null] }));
}
function buildScannerHitKey(hit, index) {
    return `${hit.filePath}:${hit.lineNumber}:${hit.matchedText}:${index}`;
}
function buildAllowlistKey(entry, index) {
    return `${entry.filePath}:${entry.matchedText}:${entry.owner}:${entry.expiresAt ?? "none"}:${index}`;
}
export function ReleaseConsoleWebView() {
    const vm = useReleaseConsoleVm();
    const featureCopy = translateFeatureCopy("release-console");
    async function copySummary() {
        const summary = vm.summaryRows.map((row) => `${row.key}: ${row.value}`).join("\n");
        await copyTextToClipboard(summary);
    }
    return (_jsx(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Internal", children: _jsxs("div", { children: [_jsx(FeatureWorkbenchPanel, { items: vm.items.map((item) => ({ ...item, detailRows: [] })), actions: [
                    { id: "release-console-refresh", label: "刷新治理快照", tone: "accent", onTrigger: () => vm.refresh(), activityDescription: "已从真实后端刷新发布治理快照。" },
                    { id: "release-console-copy", label: "复制治理摘要", tone: "neutral", disabled: vm.summaryRows.length === 0, onTrigger: () => copySummary(), activityDescription: "已复制当前发布治理摘要。" },
                    { id: "release-console-leadership-claims", label: "查看声明治理", tone: "neutral", onTrigger: buildWorkbenchActionHandler("release-console", "leadership-claims", { deepLinkPath: "/operations/release-console/leadership-claims" }), activityDescription: "已跳转到真实声明治理页面。" },
                ] }), _jsxs("div", { style: { display: "grid", gap: 16, marginTop: 24 }, children: [_jsx(GovernanceSection, { title: translateMessage("ui.releaseConsole.summary.title"), children: vm.loading ? _jsx("p", { children: translateMessage("ui.releaseConsole.loading") }) : _jsx(KeyValueTable, { rows: vm.summaryRows }) }), vm.leadershipClaims != null ? (_jsx(GovernanceSection, { title: "Family readiness", children: _jsx(ListCard, { items: vm.leadershipClaims.families.map((family) => ({
                                    title: family.displayName,
                                    description: `${family.readinessStatus} / ${family.targetClaimLevel} / ${family.owner}`,
                                })) }) })) : null] })] }) }));
}
export function LeadershipClaimsWebView() {
    const vm = useReleaseConsoleVm();
    const featureCopy = translateFeatureCopy("release-console");
    return (_jsx(FeatureScaffold, { title: translateMessage("ui.releaseConsole.claims.title"), summary: featureCopy.summary, status: "Implemented/Internal", children: vm.loading || vm.leadershipClaims == null ? (_jsx("p", { children: translateMessage("ui.releaseConsole.loading") })) : (_jsxs("div", { style: { display: "grid", gap: 24 }, children: [_jsxs(GovernanceSection, { title: translateMessage("ui.releaseConsole.summary.title"), children: [_jsx(KeyValueTable, { rows: vm.summaryRows }), vm.errorMessage != null ? _jsx("p", { style: { color: "#9f1239", margin: 0 }, children: vm.errorMessage }) : null] }), _jsx(GovernanceSection, { title: "Family readiness", children: _jsx("div", { style: { display: "grid", gap: 12 }, children: vm.leadershipClaims.families.map((family) => (_jsx(GovernanceRow, { title: `${family.displayName} · ${family.readinessStatus}`, status: family.targetClaimLevel, description: [
                                        `Owner: ${family.owner} / Claim review owner: ${family.familyPolicy.claimReviewOwner}`,
                                        `Target claim: ${family.targetClaimLevel}`,
                                        `Leadership types: ${family.familyPolicy.leadershipTypes.join(", ") || "n/a"}`,
                                        `Divisions: ${family.canonicalDivisions.join(", ") || "n/a"}`,
                                        `MVP thresholds: ${family.mvpThresholds.map((item) => `${item.label} ${item.requirement}`).join(" / ") || "n/a"}`,
                                        `Leadership thresholds: ${family.leadershipThresholds.map((item) => `${item.label} ${item.requirement}`).join(" / ") || "n/a"}`,
                                        `No-go boundary: ${family.familyPolicy.noGoBoundaryRef ?? "n/a"}`,
                                    ].join("\n") }, family.familyId))) }) }), _jsx(GovernanceSection, { title: "Claim records", children: _jsx("div", { style: { display: "grid", gap: 12 }, children: vm.leadershipClaims.claims.map((claim) => (_jsx(GovernanceRow, { title: `${claim.familyId} · ${claim.claimLevel} · ${claim.effectiveStatus}`, status: claim.effectiveStatus, description: [
                                        claim.claimText,
                                        `Evidence: ${claim.evidenceRefs.join(", ") || "n/a"}`,
                                        `Owner: ${claim.owner ?? "n/a"} / Requested by: ${claim.requestedBy ?? "n/a"}`,
                                        `Submitted: ${claim.submittedAt ?? "n/a"}`,
                                        `Expires: ${claim.expiresAt ?? "none"}`,
                                        `Freshness: ${claim.freshnessStatus}`,
                                        `Reason: ${claim.effectiveStatusReasonCode ?? "n/a"}`,
                                        `Revoked by: ${claim.revokedBy ?? "n/a"}`,
                                    ].join("\n"), action: claim.effectiveStatus === "approved" ? (_jsx("button", { type: "button", disabled: vm.mutating, onClick: () => void vm.revokeClaim(claim.claimId), children: "Revoke claim" })) : undefined }, claim.claimId))) }) }), _jsx(GovernanceSection, { title: "Scanner hits", children: _jsx("div", { style: { display: "grid", gap: 12 }, children: vm.leadershipClaims.scannerHits.map((hit, index) => (_jsx(GovernanceRow, { title: `${hit.status} · ${hit.matchedText}`, status: hit.status, description: `${hit.filePath}:${hit.lineNumber}\n${hit.excerpt}\n${hit.reason ?? "unreviewed"}` }, buildScannerHitKey(hit, index)))) }) }), _jsx(GovernanceSection, { title: "Allowlist entries", children: _jsx("div", { style: { display: "grid", gap: 12 }, children: vm.leadershipClaims.allowlist.map((entry, index) => (_jsx(GovernanceRow, { title: `${entry.expired ? "expired_allowlist" : "allowlist"} · ${entry.matchedText}`, status: entry.expired ? "expired_allowlist" : "allowlisted", description: [
                                        `${entry.filePath}`,
                                        `Owner: ${entry.owner}`,
                                        `Claim level: ${entry.claimLevel ?? "n/a"} / Surface: ${entry.surface ?? "n/a"}`,
                                        `Expires: ${entry.expiresAt ?? "n/a"}`,
                                        `Replacement: ${entry.replacementSuggestion ?? "n/a"}`,
                                        `Reason: ${entry.reason}`,
                                    ].join("\n") }, buildAllowlistKey(entry, index)))) }) }), _jsx(GovernanceSection, { title: "Review requests", children: _jsx("div", { style: { display: "grid", gap: 12 }, children: vm.leadershipClaims.reviewRequests.map((request) => (_jsx(GovernanceRow, { title: `${request.familyId} · ${request.requestedClaimLevel} · ${request.status}`, status: request.status, description: [
                                        `${request.requestedBy} / ${request.rationale}`,
                                        `Surfaces: ${request.requestedSurfaces.join(", ")}`,
                                        `Evidence: ${request.evidenceRefs.join(", ") || "n/a"}`,
                                        `Decision: ${request.decisionReasonCode ?? "pending"}`,
                                    ].join("\n"), action: request.status === "pending" ? (_jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { type: "button", disabled: vm.mutating, onClick: () => void vm.approveReviewRequest(request.requestId), children: "Approve review" }), _jsx("button", { type: "button", disabled: vm.mutating, onClick: () => void vm.rejectReviewRequest(request.requestId), children: "Reject review" })] })) : undefined }, request.requestId))) }) }), _jsx(GovernanceSection, { title: "No-go actions", children: _jsx("div", { style: { display: "grid", gap: 12 }, children: vm.leadershipClaims.noGoActions.map((action) => (_jsx(GovernanceRow, { title: `${action.id} · ${action.riskClass}`, status: action.familyId ?? "global", description: [
                                        action.description,
                                        `Scopes: ${action.scopes.join(", ") || "n/a"}`,
                                        `Surfaces: ${action.enforcementSurfaces.join(", ") || "n/a"}`,
                                        `Block modes: ${action.blockModes.join(", ") || "n/a"}`,
                                        `Sources: ${action.sources.join(", ") || "n/a"}`,
                                    ].join("\n") }, `${action.familyId ?? "global"}:${action.id}`))) }) })] })) }));
}
