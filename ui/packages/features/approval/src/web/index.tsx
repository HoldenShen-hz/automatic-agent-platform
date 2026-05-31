import { useId, useState, type ReactElement } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, Stack, ThreePaneLayout, designTokens } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useApprovalCenterVm } from "../hooks";

export function ApprovalWebView(): ReactElement {
  const vm = useApprovalCenterVm();
  const featureCopy = translateFeatureCopy("approval");
  const [delegateTarget, setDelegateTarget] = useState("domain-admin");
  const selectedApproval = vm.selectedApproval;
  const delegateInputId = useId();
  const approvalActionDescriptionId = useId();
  const delegateActionDescriptionId = useId();

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Contracted">
      <ThreePaneLayout
        left={(
          <div>
            <h3>{translateMessage("ui.approval.queueTitle")} · {vm.queueDepth}</h3>
            <Stack gap={10}>
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
            </Stack>
          </div>
        )}
        center={selectedApproval == null ? <p>{translateMessage("ui.approval.noSelection")}</p> : (
          <Stack gap={16}>
            <p id={approvalActionDescriptionId} style={{ margin: 0 }}>
              {translateMessage("ui.approval.guidance")}
            </p>
            <KeyValueTable
              rows={[
                { key: translateMessage("ui.approval.field.task"), value: selectedApproval.taskId },
                { key: translateMessage("ui.approval.field.risk"), value: selectedApproval.riskLevel },
                { key: translateMessage("ui.approval.field.reason"), value: selectedApproval.reasonSummary },
                { key: translateMessage("ui.approval.field.deadline"), value: selectedApproval.deadline ?? translateMessage("ui.approval.notAvailable") },
                { key: translateMessage("ui.approval.field.policySource"), value: selectedApproval.policySource ?? translateMessage("ui.approval.notAvailable") },
                { key: translateMessage("ui.approval.field.recommendedOption"), value: selectedApproval.recommendedOption ?? translateMessage("ui.approval.notAvailable") },
                { key: translateMessage("ui.approval.field.approvalLevel"), value: selectedApproval.currentLevel != null && selectedApproval.totalLevels != null ? `${selectedApproval.currentLevel}/${selectedApproval.totalLevels}` : translateMessage("ui.approval.singleLevel") },
              ]}
            />
            <Inline>
              <button aria-describedby={approvalActionDescriptionId} onClick={vm.approve} type="button">{translateMessage("ui.approval.approve")}</button>
              <button aria-describedby={approvalActionDescriptionId} onClick={vm.reject} type="button">{translateMessage("ui.approval.reject")}</button>
              <button onClick={() => { void vm.requestMoreContext(); }} type="button">{translateMessage("ui.approval.requestContext")}</button>
            </Inline>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void vm.delegate(delegateTarget);
              }}
            >
              <Inline>
              <input
                aria-label={translateMessage("ui.approval.delegateTarget")}
                id={delegateInputId}
                onChange={(event) => setDelegateTarget(event.target.value)}
                value={delegateTarget}
              />
              <span id={delegateActionDescriptionId} style={{ display: "none" }}>
                {translateMessage("ui.approval.delegateGuide.description")}
              </span>
              <button
                aria-describedby={delegateActionDescriptionId}
                type="submit"
              >
                {translateMessage("ui.approval.delegate")}
              </button>
              </Inline>
            </form>
            <Inline>
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
            </Inline>
          </Stack>
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
