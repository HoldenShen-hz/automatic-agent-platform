import { useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useApprovalCenterVm } from "../hooks";

export function ApprovalWebView(): ReactElement {
  const vm = useApprovalCenterVm();
  const [delegateTarget, setDelegateTarget] = useState("domain-admin");
  const selectedApproval = vm.selectedApproval;

  return (
    <FeatureScaffold title="Approval Center" summary="审批队列、委派与恢复动作闭环" status="Implemented/Contracted">
      <ThreePaneLayout
        left={(
          <div>
            <h3>Approval Queue · {vm.queueDepth}</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {vm.queueItems.map((approval) => (
                <button
                  key={approval.id}
                  onClick={() => {
                    vm.selectApproval(approval.id);
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
          <div style={{ display: "grid", gap: 16 }}>
            <KeyValueTable
              rows={[
                { key: "Task", value: selectedApproval.taskId },
                { key: "Risk", value: selectedApproval.riskLevel },
                { key: "Reason", value: selectedApproval.reasonSummary },
                { key: "Action", value: "Approve / Reject / Delegate" },
              ]}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={vm.approve} type="button">Approve</button>
              <button onClick={vm.reject} type="button">Reject</button>
              <input onChange={(event) => setDelegateTarget(event.target.value)} value={delegateTarget} />
              <button
                onClick={() => {
                  vm.delegate(delegateTarget);
                }}
                type="button"
              >
                Delegate
              </button>
            </div>
          </div>
        )}
        right={(
          <ListCard
            items={vm.actionHistory.length > 0 ? vm.actionHistory : [
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
