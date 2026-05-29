import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useMissionConsoleVm } from "../hooks";
export function MissionConsoleWebView() {
    const vm = useMissionConsoleVm();
    const mission = vm.selectedMission;
    return (_jsx(FeatureScaffold, { title: "Mission Console", summary: "\u76EE\u6807\u3001\u9884\u7B97\u3001\u4EFB\u52A1\u3001\u8FD0\u884C\u548C\u8BC1\u636E\u5728\u4E00\u4E2A\u6CBB\u7406\u89C6\u56FE\u91CC\u6C47\u5408\u3002", status: "Implemented/Contracted", children: vm.loading ? _jsx("p", { children: "Loading missions..." }) : (_jsx(ThreePaneLayout, { left: (_jsx(ListCard, { items: vm.missions.map((item) => ({
                    title: item.title,
                    description: `${item.status} / ${item.priority} / ${item.type} / policies ${item.policyRefs?.length ?? 0}`,
                    actionLabel: item.missionId === vm.selectedMissionId ? "Selected" : "Open",
                    onAction: () => vm.selectMission(item.missionId),
                })) })), center: mission == null ? _jsx("p", { children: "No Mission available." }) : (_jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsx(KeyValueTable, { rows: [
                            { key: "Mission", value: mission.missionId },
                            { key: "Objective", value: mission.objective },
                            { key: "Success", value: mission.successCriteria.join(", ") || "pending refinement" },
                            { key: "Owner", value: mission.ownerPrincipalId },
                            { key: "Accountable", value: mission.accountablePrincipalId ?? "not assigned" },
                            { key: "Domain", value: mission.domainId ?? "cross-domain" },
                            { key: "Budget", value: vm.budget?.status ?? "loading" },
                            { key: "Updated", value: mission.updatedAt },
                        ] }), _jsxs("section", { children: [_jsx("h3", { children: "Tasks" }), _jsx(ListCard, { items: vm.tasks.map((task) => ({ title: task.title, description: `${task.status} / ${task.ref}` })) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Members & Permissions" }), _jsx(ListCard, { items: vm.members.map((member) => ({
                                    title: `${member.principalId} (${member.role})`,
                                    description: `${member.status} / ${member.principalType} / permissions ${member.permissions.length}`,
                                })) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Knowledge & Learning" }), _jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsx(KeyValueTable, { rows: vm.knowledgeLearningSummary.map((item) => ({ key: item.key, value: item.value })) }), _jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsxs("div", { children: [_jsx("h4", { children: "Knowledge Assets" }), _jsx(ListCard, { items: vm.knowledge.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` })) })] }), _jsxs("div", { children: [_jsx("h4", { children: "Learning Records" }), _jsx(ListCard, { items: vm.learning.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` })) })] })] })] })] })] })), right: (_jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsxs("section", { children: [_jsx("h3", { children: "Runs" }), _jsx(ListCard, { items: vm.runs.map((run) => ({ title: run.title, description: run.status })) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Evidence" }), _jsx(ListCard, { items: vm.evidence.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` })) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Settings" }), _jsx(KeyValueTable, { rows: vm.missionSettings.map((item) => ({ key: item.key, value: item.value })) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Guardrails" }), _jsx(ListCard, { items: vm.operatorNotices })] }), _jsxs("section", { children: [_jsx("h3", { children: "Actions" }), _jsx(ListCard, { items: vm.recommendedActions })] })] })) })) }));
}
