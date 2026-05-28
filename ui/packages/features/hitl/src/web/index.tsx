import { useState, type ReactElement } from "react";
import { FeatureScaffold, Inline, ListCard, Stack, designTokens } from "@aa/ui-core";
import { useHitlVm } from "../hooks";

export function HitlWebView(): ReactElement {
  const vm = useHitlVm();
  const [editorMode, setEditorMode] = useState<"patch" | "override" | null>(null);
  const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("{}");
  const [editorError, setEditorError] = useState<string | null>(null);

  async function applyEditor(): Promise<void> {
    if (editorTargetId == null || editorMode == null) {
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      const candidate = JSON.parse(editorValue);
      if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) {
        setEditorError("Editor payload must be a JSON object.");
        return;
      }
      parsed = candidate as Record<string, unknown>;
    } catch {
      setEditorError("Editor payload must be valid JSON.");
      return;
    }
    try {
      if (editorMode === "patch") {
        await vm.patch(editorTargetId, parsed);
      } else {
        await vm.override(editorTargetId, parsed);
      }
      setEditorError(null);
      setEditorMode(null);
      setEditorTargetId(null);
      setEditorValue("{}");
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <FeatureScaffold title="HITL" summary="人工介入、Inspect、Takeover、Resume 的统一入口" status="Implemented/Partial">
      <Stack>
        <Inline>
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
        </Inline>
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
              <Inline>
                <button onClick={() => { void vm.approve(item.id); }} type="button">Approve</button>
                <button onClick={() => { void vm.reject(item.id); }} type="button">Reject</button>
                <button
                  onClick={() => {
                    setEditorMode("patch");
                    setEditorTargetId(item.id);
                    setEditorError(null);
                  }}
                  type="button"
                >
                  Patch
                </button>
                <button
                  onClick={() => {
                    setEditorMode("override");
                    setEditorTargetId(item.id);
                    setEditorError(null);
                  }}
                  type="button"
                >
                  Override
                </button>
              </Inline>
            ) : (
              <button onClick={() => { void vm.resume(item.id, "normal"); }} type="button">Resume</button>
            )}
          </div>
        ))}
        {editorMode != null && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void applyEditor();
            }}
          >
            <Stack gap={8}>
            <textarea onChange={(event) => setEditorValue(event.target.value)} value={editorValue} />
            {editorError != null ? <p role="alert">{editorError}</p> : null}
            <button type="submit">Apply</button>
            </Stack>
          </form>
        )}
      </Stack>
    </FeatureScaffold>
  );
}
