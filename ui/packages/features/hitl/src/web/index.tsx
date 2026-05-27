import { useState, type ReactElement } from "react";
import { FeatureScaffold, ListCard, designTokens } from "@aa/ui-core";
import { useHitlVm } from "../hooks";

export function HitlWebView(): ReactElement {
  const vm = useHitlVm();
  const [editorMode, setEditorMode] = useState<"patch" | "override" | null>(null);
  const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("{}");

  async function applyEditor(): Promise<void> {
    if (editorTargetId == null || editorMode == null) {
      return;
    }
    const parsed = JSON.parse(editorValue) as Record<string, unknown>;
    if (editorMode === "patch") {
      await vm.patch(editorTargetId, parsed);
    } else {
      await vm.override(editorTargetId, parsed);
    }
    setEditorMode(null);
    setEditorTargetId(null);
    setEditorValue("{}");
  }

  return (
    <FeatureScaffold title="HITL" summary="人工介入、Inspect、Takeover、Resume 的统一入口" status="Implemented/Partial">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={vm.items.length === 0}
            onClick={() => {
              void vm.bulkApprove(vm.items.filter((item) => item.type === "approval").map((item) => item.id));
            }}
            type="button"
          >
            Bulk Approve
          </button>
          <button
            disabled={vm.items.length === 0}
            onClick={() => {
              void vm.bulkReject(vm.items.filter((item) => item.type === "approval").map((item) => item.id));
            }}
            type="button"
          >
            Bulk Reject
          </button>
        </div>
        <ListCard items={vm.items.map((item) => ({
          title: item.title,
          description: item.description,
        }))}
        />
        {vm.items.map((item) => (
          <div key={item.id} style={{ border: `1px solid ${designTokens.color.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
            <div>
              <strong>{item.title}</strong>
              <div>{item.description}</div>
              {item.secondsRemaining != null && <div>{`SLA: ${item.secondsRemaining}s remaining`}</div>}
              {item.escalationTarget != null && <div>{`Escalation: ${item.escalationTarget}`}</div>}
            </div>
            {item.type === "approval" ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { void vm.approve(item.id); }} type="button">Approve</button>
                <button onClick={() => { void vm.reject(item.id); }} type="button">Reject</button>
                <button
                  onClick={() => {
                    setEditorMode("patch");
                    setEditorTargetId(item.id);
                  }}
                  type="button"
                >
                  Patch
                </button>
                <button
                  onClick={() => {
                    setEditorMode("override");
                    setEditorTargetId(item.id);
                  }}
                  type="button"
                >
                  Override
                </button>
              </div>
            ) : (
              <button onClick={() => { void vm.resume(item.id, "normal"); }} type="button">Resume</button>
            )}
          </div>
        ))}
        {editorMode != null && (
          <div style={{ display: "grid", gap: 8 }}>
            <textarea onChange={(event) => setEditorValue(event.target.value)} value={editorValue} />
            <button onClick={() => { void applyEditor(); }} type="button">Apply</button>
          </div>
        )}
      </div>
    </FeatureScaffold>
  );
}
