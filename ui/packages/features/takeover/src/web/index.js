import { jsx, jsxs } from "react/jsx-runtime";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useTakeoverVm } from "../hooks";
function TakeoverWebView() {
  const vm = useTakeoverVm();
  const featureCopy = translateFeatureCopy("takeover");
  const snapshot = vm.currentSnapshot;
  return /* @__PURE__ */ jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: [
    /* @__PURE__ */ jsx("p", { style: { marginTop: 0 }, children: "\u4EBA\u5DE5\u6279\u6CE8\u5F53\u524D\u53EA\u4FDD\u5B58\u5728\u6D4F\u89C8\u5668\u672C\u5730\u5386\u53F2\u4E2D\uFF1B\u540E\u7AEF takeover annotation / audit \u63A5\u53E3\u5C1A\u672A\u63D0\u4F9B\u3002" }),
    /* @__PURE__ */ jsx("p", { style: { marginTop: 0 }, children: "\u201C\u6062\u590D\u4EFB\u52A1\u8FD0\u884C\u201D \u5F53\u524D\u53EA\u4F1A\u628A\u4EFB\u52A1\u91CD\u65B0\u5199\u56DE `running` \u72B6\u6001\uFF0C\u4E0D\u4F1A\u628A owner \u4ECE\u4EBA\u5DE5\u63A5\u7BA1\u5207\u56DE\u81EA\u52A8\u6267\u884C\uFF1B\u540E\u7AEF restore-automation \u63A5\u53E3\u5C1A\u672A\u63D0\u4F9B\u3002" }),
    /* @__PURE__ */ jsx(
      FeatureWorkbenchPanel,
      {
        items: vm.items,
        actions: [
          { id: "takeover-start", label: "\u63A5\u7BA1\u5F53\u524D\u4EFB\u52A1", tone: "danger", disabled: !vm.canTakeover, onTrigger: () => vm.takeoverCurrentTask("web-operator") },
          { id: "takeover-annotate", label: "\u6DFB\u52A0\u4EBA\u5DE5\u6279\u6CE8", tone: "neutral", disabled: !vm.canAnnotate, onTrigger: () => vm.annotateCurrentSnapshot("manual-note", "web-operator") },
          { id: "takeover-resume", label: "\u6062\u590D\u4EFB\u52A1\u8FD0\u884C", tone: "accent", disabled: !vm.canResume, onTrigger: () => vm.resumeAutomaticExecution("web-operator") }
        ]
      }
    ),
    /* @__PURE__ */ jsxs("section", { "aria-label": "Current takeover snapshot", style: { display: "grid", gap: 12, marginTop: 16 }, children: [
      /* @__PURE__ */ jsx("h3", { style: { margin: 0 }, children: "Current snapshot" }),
      snapshot == null ? /* @__PURE__ */ jsx("p", { style: { margin: 0 }, children: "No takeover snapshot captured yet." }) : /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
        /* @__PURE__ */ jsxs(
          "dl",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "max-content 1fr",
              gap: "8px 12px",
              margin: 0
            },
            children: [
              /* @__PURE__ */ jsx("dt", { children: "Task" }),
              /* @__PURE__ */ jsx("dd", { style: { margin: 0 }, children: snapshot.taskId }),
              /* @__PURE__ */ jsx("dt", { children: "Owner" }),
              /* @__PURE__ */ jsx("dd", { style: { margin: 0 }, children: snapshot.owner }),
              /* @__PURE__ */ jsx("dt", { children: "Status" }),
              /* @__PURE__ */ jsx("dd", { style: { margin: 0 }, children: snapshot.status }),
              /* @__PURE__ */ jsx("dt", { children: "Captured at" }),
              /* @__PURE__ */ jsx("dd", { style: { margin: 0 }, children: snapshot.capturedAt })
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h4", { style: { marginBottom: 8 }, children: "Captured steps" }),
          /* @__PURE__ */ jsx("ul", { style: { margin: 0, paddingLeft: 20 }, children: snapshot.steps.map((step, index) => /* @__PURE__ */ jsxs("li", { children: [
            typeof step === "object" && step != null && "title" in step ? `${String(step.title)}` : `Step ${index + 1}`,
            typeof step === "object" && step != null && "status" in step ? ` \xB7 ${String(step.status)}` : "",
            typeof step === "object" && step != null && "executor" in step ? ` \xB7 ${String(step.executor)}` : ""
          ] }, typeof step === "object" && step != null && "id" in step ? String(step.id) : `${snapshot.taskId}-${index}`)) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { "aria-label": "Takeover ownership history", style: { display: "grid", gap: 12, marginTop: 16 }, children: [
      /* @__PURE__ */ jsx("h3", { style: { margin: 0 }, children: "Ownership history" }),
      vm.ownershipHistory.length === 0 ? /* @__PURE__ */ jsx("p", { style: { margin: 0 }, children: "No takeover actions recorded yet." }) : /* @__PURE__ */ jsx("ul", { style: { margin: 0, paddingLeft: 20 }, children: vm.ownershipHistory.map((entry) => /* @__PURE__ */ jsxs("li", { children: [
        entry.recordedAt,
        " \xB7 ",
        entry.taskId,
        " \xB7 ",
        entry.owner,
        " \xB7 ",
        entry.action
      ] }, `${entry.recordedAt}-${entry.taskId}-${entry.action}`)) })
    ] })
  ] });
}
export {
  TakeoverWebView
};
