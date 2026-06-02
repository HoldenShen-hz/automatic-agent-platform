import { useState, type ReactElement } from "react";
import { FeatureScaffold, Inline, ListCard, Stack, designTokens } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useHitlVm } from "../hooks";

export function HitlWebView(): ReactElement {
  const featureCopy = translateFeatureCopy("hitl");
  const vm = useHitlVm();
  const [editorMode, setEditorMode] = useState<"patch" | "override" | null>(null);
  const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("{}");
  const [editorError, setEditorError] = useState<string | null>(null);
  const editorErrorId = "hitl-editor-error";

  async function applyEditor(): Promise<void> {
    if (editorTargetId == null || editorMode == null) {
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      const candidate = JSON.parse(editorValue);
      if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) {
        setEditorError(translateMessage("ui.hitl.editor.error.object"));
        return;
      }
      parsed = candidate as Record<string, unknown>;
    } catch {
      setEditorError(translateMessage("ui.hitl.editor.error.json"));
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
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <Stack>
        <Inline>
          <button
            disabled={vm.items.length === 0}
            onClick={() => {
              if (!window.confirm(translateMessage("ui.hitl.bulkApprove"))) {
                return;
              }
              void vm.bulkApprove(vm.items.filter((item) => item.type === "approval").map((item) => item.id));
            }}
            type="button"
          >
            {translateMessage("ui.hitl.bulkApprove")}
          </button>
          <button
            disabled={vm.items.length === 0}
            onClick={() => {
              if (!window.confirm(translateMessage("ui.hitl.bulkReject"))) {
                return;
              }
              void vm.bulkReject(vm.items.filter((item) => item.type === "approval").map((item) => item.id));
            }}
            type="button"
          >
            {translateMessage("ui.hitl.bulkReject")}
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
              {item.secondsRemaining != null && <div>{translateMessage("ui.hitl.item.sla", { seconds: item.secondsRemaining })}</div>}
              {item.escalationTarget != null && <div>{translateMessage("ui.hitl.item.escalation", { target: item.escalationTarget })}</div>}
            </div>
            {item.type === "approval" ? (
              <Inline>
                <button onClick={() => { void vm.approve(item.id); }} type="button">{translateMessage("ui.hitl.approve")}</button>
                <button onClick={() => { void vm.reject(item.id); }} type="button">{translateMessage("ui.hitl.reject")}</button>
                <button
                  onClick={() => {
                    setEditorMode("patch");
                    setEditorTargetId(item.id);
                    setEditorError(null);
                  }}
                  type="button"
                >
                  {translateMessage("ui.hitl.patch")}
                </button>
                <button
                  onClick={() => {
                    setEditorMode("override");
                    setEditorTargetId(item.id);
                    setEditorError(null);
                  }}
                  type="button"
                >
                  {translateMessage("ui.hitl.override")}
                </button>
              </Inline>
            ) : (
              <button
                onClick={() => {
                  if (!window.confirm(translateMessage("ui.hitl.resume"))) {
                    return;
                  }
                  void vm.resume(item.id, "normal");
                }}
                type="button"
              >
                {translateMessage("ui.hitl.resume")}
              </button>
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
            <textarea
              aria-describedby={editorError != null ? editorErrorId : undefined}
              aria-label={translateMessage("ui.hitl.editor.label")}
              onChange={(event) => setEditorValue(event.target.value)}
              value={editorValue}
            />
            {editorError != null ? <p id={editorErrorId} role="alert">{editorError}</p> : null}
            <button type="submit">{translateMessage("ui.hitl.apply")}</button>
            </Stack>
          </form>
        )}
      </Stack>
    </FeatureScaffold>
  );
}
