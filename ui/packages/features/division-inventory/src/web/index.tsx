import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useDivisionInventoryVm } from "../hooks";

function colorForRisk(risk: string): string {
  if (risk === "critical") return "#9f1239";
  if (risk === "high") return "#b45309";
  return "#166534";
}

export function DivisionInventoryWebView(): ReactElement {
  const copy = translateFeatureCopy("division-inventory");
  const vm = useDivisionInventoryVm();
  return (
    <FeatureScaffold title={copy.title} summary={copy.summary} status="Implemented/Partial">
      {vm.loading ? <p>Loading inventory...</p> : null}
      <div style={{ display: "grid", gap: 16 }}>
        <KeyValueTable rows={vm.summaryRows} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>
            Family
            <select value={vm.familyFilter} onChange={(event) => vm.setFamilyFilter(event.target.value)}>
              {vm.familyOptions.map((familyId) => (
                <option key={familyId} value={familyId}>
                  {familyId === "all" ? "All" : familyId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={vm.statusFilter} onChange={(event) => vm.setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="pilot_ready">pilot_ready</option>
              <option value="coverage_draft">coverage_draft</option>
              <option value="untracked">untracked</option>
            </select>
          </label>
          <label>
            Risk
            <select value={vm.riskFilter} onChange={(event) => vm.setRiskFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={vm.blockerOnly} onChange={(event) => vm.setBlockerOnly(event.target.checked)} />
            Blockers only
          </label>
        </div>
        <ListCard
          items={vm.filteredRecords.map((record) => ({
            title: `${record.divisionId} · ${record.status}`,
            description: [
              `${record.familyId ?? "unknown"} / ${record.riskLevel} / ${colorForRisk(record.riskLevel)}`,
              `Coverage: ${record.hasCoverageCard ? "yes" : "no"} / Eval: ${record.hasEval ? "yes" : "no"} / Red-team: ${record.hasRedTeam ? "yes" : "no"}`,
              `Blockers: ${record.blockers.join(", ") || "none"}`,
            ].join("\n"),
          }))}
        />
      </div>
    </FeatureScaffold>
  );
}
