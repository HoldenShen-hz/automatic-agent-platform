import { useMemo, useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useApprovalCenterVm } from "../hooks";

export function ApprovalWebView(): ReactElement {
  const vm = useApprovalCenterVm();
  const [selectedId, setSelectedId] = useState<string | null>(vm.approvals[0]?.approvalId ?? null);
  const selectedApproval = useMemo(
    () => vm.approvals.find((approval) => approval.approvalId === selectedId) ?? vm.approvals[0] ?? null,
    [vm.approvals, selectedId],
  );

  return (
    <FeatureScaffold title="Approval Center" summary="审批队列与快捷动作" status="Implemented/Contracted">
      <ThreePaneLayout
        left={(
          <div>
            <h3>Approval Queue</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {vm.queueItems.map((approval) => (
                <button
                  key={approval.id}
                  onClick={() => {
                    setSelectedId(approval.id);
                  }}
                  style={{ textAlign: "left", background: approval.id === selectedApproval?.approvalId ? "#12201a" : "transparent", color: "inherit", border: "1px solid #334155", borderRadius: 12, padding: 12 }}
                  type="button"
                >
                  <strong>{approval.title}</strong>
                  <div>{approval.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        center={selectedApproval == null ? <p>No approval selected</p> : (
          <KeyValueTable
            rows={[
              { key: "Task", value: selectedApproval.taskId },
              { key: "Risk", value: selectedApproval.riskLevel },
              { key: "Reason", value: selectedApproval.reasonSummary },
              { key: "Action", value: "Approve / Reject / Delegate" },
            ]}
          />
        )}
        right={(
          <ListCard
            items={[
              { title: "Quick Approve", description: "Low-risk items can be approved directly in the queue." },
              { title: "Delegate", description: "Critical items can be escalated to domain or org admins." },
              { title: "Resume Mode", description: "After approval, execution can resume in normal or supervised mode." },
            ]}
          />
        )}
      />
    </FeatureScaffold>
  );
}
