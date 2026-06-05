import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useTakeoverVm } from "../hooks";

export function TakeoverWebView(): ReactElement {
  const vm = useTakeoverVm();
  const featureCopy = translateFeatureCopy("takeover");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "takeover-start", label: "接管当前任务", tone: "danger", disabled: !vm.canTakeover, onTrigger: () => vm.takeoverCurrentTask("web-operator") },
          { id: "takeover-annotate", label: "添加人工批注", tone: "neutral", disabled: !vm.canAnnotate, onTrigger: () => vm.annotateCurrentSnapshot("manual-note", "web-operator") },
          { id: "takeover-resume", label: "恢复自动执行", tone: "accent", disabled: !vm.canResume, onTrigger: () => vm.resumeAutomaticExecution("web-operator") },
        ]}
      />
      <section aria-label="Current takeover snapshot" style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Current snapshot</h3>
        {vm.currentSnapshot == null ? (
          <p style={{ margin: 0 }}>No takeover snapshot captured yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "max-content 1fr",
                gap: "8px 12px",
                margin: 0,
              }}
            >
              <dt>Task</dt>
              <dd style={{ margin: 0 }}>{vm.currentSnapshot.taskId}</dd>
              <dt>Owner</dt>
              <dd style={{ margin: 0 }}>{vm.currentSnapshot.owner}</dd>
              <dt>Status</dt>
              <dd style={{ margin: 0 }}>{vm.currentSnapshot.status}</dd>
              <dt>Captured at</dt>
              <dd style={{ margin: 0 }}>{vm.currentSnapshot.capturedAt}</dd>
            </dl>
            <div>
              <h4 style={{ marginBottom: 8 }}>Captured steps</h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {vm.currentSnapshot.steps.map((step, index) => (
                  <li key={typeof step === "object" && step != null && "id" in step ? String(step.id) : `${vm.currentSnapshot.taskId}-${index}`}>
                    {typeof step === "object" && step != null && "title" in step
                      ? `${String(step.title)}`
                      : `Step ${index + 1}`}
                    {typeof step === "object" && step != null && "status" in step
                      ? ` · ${String(step.status)}`
                      : ""}
                    {typeof step === "object" && step != null && "executor" in step
                      ? ` · ${String(step.executor)}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
      <section aria-label="Takeover ownership history" style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Ownership history</h3>
        {vm.ownershipHistory.length === 0 ? (
          <p style={{ margin: 0 }}>No takeover actions recorded yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {vm.ownershipHistory.map((entry) => (
              <li key={`${entry.recordedAt}-${entry.taskId}-${entry.action}`}>
                {entry.recordedAt} · {entry.taskId} · {entry.owner} · {entry.action}
              </li>
            ))}
          </ul>
        )}
      </section>
    </FeatureScaffold>
  );
}
