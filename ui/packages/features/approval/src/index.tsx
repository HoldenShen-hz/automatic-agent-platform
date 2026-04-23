import { useMemo, useState } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout, createFeatureModule } from "@aa/ui-core";
import { useApprovalsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "approval",
  title: "Approval Center",
  group: "Mission Control",
  path: "/mission-control/approvals",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: "审批中心，支持风险摘要和人工决策入口。",
  render: () => {
    const query = useApprovalsQuery();
    const approvals = query.data ?? [];
    const [selectedId, setSelectedId] = useState<string | null>(approvals[0]?.approvalId ?? null);
    const selectedApproval = useMemo(
      () => approvals.find((approval) => approval.approvalId === selectedId) ?? approvals[0] ?? null,
      [approvals, selectedId],
    );
    return (
      <FeatureScaffold title="Approval Center" summary="审批队列与快捷动作" status="Implemented/Contracted">
        <ThreePaneLayout
          left={(
            <div>
              <h3>Approval Queue</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {approvals.map((approval) => (
                  <button
                    key={approval.approvalId}
                    onClick={() => {
                      setSelectedId(approval.approvalId);
                    }}
                    style={{ textAlign: "left", background: approval.approvalId === selectedApproval?.approvalId ? "#12201a" : "transparent", color: "inherit", border: "1px solid #334155", borderRadius: 12, padding: 12 }}
                    type="button"
                  >
                    <strong>{approval.taskId}</strong>
                    <div>{approval.riskLevel}</div>
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
  },
});
