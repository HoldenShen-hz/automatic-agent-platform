import { useId, useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout, designTokens } from "@aa/ui-core";
import { translateMessage } from "@aa/shared-i18n";
import { useApprovalCenterVm } from "../hooks";

export function ApprovalWebView(): ReactElement {
  const vm = useApprovalCenterVm();
  const [delegateTarget, setDelegateTarget] = useState("domain-admin");
  const selectedApproval = vm.selectedApproval;
  const delegateInputId = useId();
  const approvalActionDescriptionId = useId();

  return (
    <FeatureScaffold title="Approval Center" summary="审批队列、委派与恢复动作闭环" status="Implemented/Contracted">
      <ThreePaneLayout
        left={(
          <div>
            <h3>{translateMessage("ui.approval.queueTitle")} · {vm.queueDepth}</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {vm.queueItems.map((approval) => (
                <button
                  key={approval.id}
                  onClick={() => {
                    vm.selectApproval(approval.id);
                  }}
                  style={{
                    textAlign: "left",
                    background: approval.id === selectedApproval?.approvalId ? designTokens.semantic.color.surfaceSelected : "transparent",
                    color: "inherit",
                    border: `1px solid ${designTokens.color.border}`,
                    borderRadius: 12,
                    padding: 12,
                  }}
                  type="button"
                >
                  <strong>{approval.title}</strong>
                  <div>{approval.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        center={selectedApproval == null ? <p>{translateMessage("ui.approval.noSelection")}</p> : (
          <div style={{ display: "grid", gap: 16 }}>
            <p id={approvalActionDescriptionId} style={{ margin: 0 }}>
              {translateMessage("ui.approval.guidance")}
            </p>
            <KeyValueTable
              rows={[
                { key: "Task", value: selectedApproval.taskId },
                { key: "Risk", value: selectedApproval.riskLevel },
                { key: "Reason", value: selectedApproval.reasonSummary },
                { key: "Deadline", value: selectedApproval.deadline ?? translateMessage("ui.approval.notAvailable") },
                { key: "Policy Source", value: selectedApproval.policySource ?? translateMessage("ui.approval.notAvailable") },
                { key: "Recommended Option", value: selectedApproval.recommendedOption ?? translateMessage("ui.approval.notAvailable") },
                { key: "Approval Level", value: selectedApproval.currentLevel != null && selectedApproval.totalLevels != null ? `${selectedApproval.currentLevel}/${selectedApproval.totalLevels}` : translateMessage("ui.approval.singleLevel") },
              ]}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button aria-describedby={approvalActionDescriptionId} onClick={vm.approve} type="button">{translateMessage("ui.approval.approve")}</button>
              <button aria-describedby={approvalActionDescriptionId} onClick={vm.reject} type="button">{translateMessage("ui.approval.reject")}</button>
              <button onClick={() => { void vm.requestMoreContext(); }} type="button">{translateMessage("ui.approval.requestContext")}</button>
              <input
                aria-label={translateMessage("ui.approval.delegateTarget")}
                id={delegateInputId}
                onChange={(event) => setDelegateTarget(event.target.value)}
                value={delegateTarget}
              />
              <button
                aria-describedby={delegateInputId}
                onClick={() => {
                  void vm.delegate(delegateTarget);
                }}
                type="button"
              >
                {translateMessage("ui.approval.delegate")}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  void vm.approveBatch(vm.approvals.map((approval) => approval.approvalId));
                }}
                type="button"
              >
                {translateMessage("ui.approval.batchApprove")}
              </button>
              <button
                onClick={() => {
                  void vm.rejectBatch(vm.approvals.map((approval) => approval.approvalId));
                }}
                type="button"
              >
                {translateMessage("ui.approval.batchReject")}
              </button>
            </div>
          </div>
        )}
        right={(
          <ListCard
            items={vm.actionHistory.length > 0 ? vm.actionHistory : [
              { title: translateMessage("ui.approval.quickApprove.title"), description: translateMessage("ui.approval.quickApprove.description") },
              { title: translateMessage("ui.approval.delegateGuide.title"), description: translateMessage("ui.approval.delegateGuide.description") },
              { title: translateMessage("ui.approval.resumeGuide.title"), description: translateMessage("ui.approval.resumeGuide.description") },
            ]}
          />
        )}
      />
    </FeatureScaffold>
  );
}
