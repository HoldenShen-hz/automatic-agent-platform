import type { ReactElement } from "react";
import { useState } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useHitlVm } from "../hooks";
import type { HitlItem } from "../hooks";

export function HitlWebView(): ReactElement {
  const vm = useHitlVm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"patch" | "override" | null>(null);
  const [editValue, setEditValue] = useState("");

  const selectedItem = vm.items.find((item) => item.id === selectedId) ?? null;

  async function handleAction(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      console.error("[HITL] Action failed:", err);
    }
  }

  function renderActionButtons(item: HitlItem) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button
          onClick={() => handleAction(() => vm.approve(item.id))}
          type="button"
          style={{ padding: "4px 12px", borderRadius: 6, background: "#16a34a", color: "#fff", border: "none", cursor: "pointer" }}
        >
          Approve
        </button>
        <button
          onClick={() => handleAction(() => vm.reject(item.id))}
          type="button"
          style={{ padding: "4px 12px", borderRadius: 6, background: "#dc2626", color: "#fff", border: "none", cursor: "pointer" }}
        >
          Reject
        </button>
        {item.type === "resume" && (
          <button
            onClick={() => handleAction(() => vm.resume(item.id, "normal"))}
            type="button"
            style={{ padding: "4px 12px", borderRadius: 6, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}
          >
            Resume
          </button>
        )}
        <button
          onClick={() => { setSelectedId(item.id); setEditMode("patch"); }}
          type="button"
          style={{ padding: "4px 12px", borderRadius: 6, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" }}
        >
          Patch
        </button>
        <button
          onClick={() => { setSelectedId(item.id); setEditMode("override"); }}
          type="button"
          style={{ padding: "4px 12px", borderRadius: 6, background: "#d97706", color: "#fff", border: "none", cursor: "pointer" }}
        >
          Override
        </button>
      </div>
    );
  }

  return (
    <FeatureScaffold title="HITL" summary="人工介入、Inspect、Takeover、Resume 的统一入口" status="Implemented/Partial">
      <div style={{ display: "grid", gap: 16 }}>
        <ListCard
          items={vm.items.map((item) => ({
            title: item.title,
            description: item.description,
          }))}
        />
        {vm.items.length > 0 && (
          <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
            <h4>Actions</h4>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
              Select an item and use action buttons below. Patch modifies partial fields; Override replaces the entire context.
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {vm.items.map((item) => (
                <div key={item.id} style={{ padding: 12, border: "1px solid #334155", borderRadius: 8 }}>
                  <strong>{item.title}</strong>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.description}</div>
                  {renderActionButtons(item)}
                </div>
              ))}
            </div>
          </div>
        )}
        {editMode && selectedItem && (
          <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 16, background: "#0f172a" }}>
            <h4>{editMode === "patch" ? "Patch" : "Override"} - {selectedItem.title}</h4>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={editMode === "patch" ? '{"field": "newValue"}' : '{"complete": "overrideObject"}'}
              style={{ width: "100%", minHeight: 80, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: 8 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={async () => {
                  try {
                    const parsed = JSON.parse(editValue);
                    if (editMode === "patch") {
                      await vm.patch(selectedItem.id, parsed);
                    } else {
                      await vm.override(selectedItem.id, parsed);
                    }
                    setEditMode(null);
                    setEditValue("");
                  } catch (err) {
                    console.error("[HITL] Invalid JSON:", err);
                  }
                }}
                type="button"
                style={{ padding: "6px 16px", borderRadius: 6, background: "#16a34a", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Apply
              </button>
              <button
                onClick={() => { setEditMode(null); setEditValue(""); }}
                type="button"
                style={{ padding: "6px 16px", borderRadius: 6, background: "#475569", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </FeatureScaffold>
  );
}
