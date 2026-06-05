import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useMissionConsoleVm } from "../hooks";
export function MissionConsoleWebView() {
    const featureCopy = translateFeatureCopy("mission-console");
    const vm = useMissionConsoleVm();
    const mission = vm.selectedMission;
    return (_jsx(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Contracted", children: vm.loading ? _jsx("p", { children: translateMessage("ui.missionConsole.loading") }) : (_jsx(ThreePaneLayout, { left: (_jsx(ListCard, { items: vm.missions.map((item) => ({
                    title: item.title,
                    description: `${item.status} / ${item.priority} / ${item.type} / policies ${item.policyRefs?.length ?? 0}`,
                    actionLabel: item.missionId === vm.selectedMissionId ? translateMessage("ui.missionConsole.selected") : translateMessage("ui.missionConsole.open"),
                    onAction: () => vm.selectMission(item.missionId),
                })) })), center: mission == null ? _jsx("p", { children: translateMessage("ui.missionConsole.noMission") }) : (_jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsx(KeyValueTable, { rows: [
                            { key: translateMessage("ui.missionConsole.field.mission"), value: mission.missionId },
                            { key: translateMessage("ui.missionConsole.field.objective"), value: mission.objective },
                            { key: translateMessage("ui.missionConsole.field.success"), value: mission.successCriteria.join(", ") || translateMessage("ui.missionConsole.value.pendingRefinement") },
                            { key: translateMessage("ui.missionConsole.field.owner"), value: mission.ownerPrincipalId },
                            { key: translateMessage("ui.missionConsole.field.accountable"), value: mission.accountablePrincipalId ?? translateMessage("ui.missionConsole.value.notAssigned") },
                            { key: translateMessage("ui.missionConsole.field.domain"), value: mission.domainId ?? translateMessage("ui.missionConsole.value.crossDomain") },
                            { key: translateMessage("ui.missionConsole.field.budget"), value: vm.budget?.status ?? translateMessage("ui.missionConsole.value.loading") },
                            { key: translateMessage("ui.missionConsole.field.updated"), value: mission.updatedAt },
                        ] }), _jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.tasks") }), _jsx(ListCard, { items: vm.tasks.map((task) => ({ title: task.title, description: `${task.status} / ${task.ref}` })) })] }), _jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.members") }), _jsx(ListCard, { items: vm.members.map((member) => ({
                                    title: `${member.principalId} (${member.role})`,
                                    description: `${member.status} / ${member.principalType} / permissions ${member.permissions.length}`,
                                })) })] }), _jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.knowledgeLearning") }), _jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsx(KeyValueTable, { rows: vm.knowledgeLearningSummary.map((item) => ({ key: item.key, value: item.value })) }), _jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsxs("div", { children: [_jsx("h4", { children: translateMessage("ui.missionConsole.section.knowledgeAssets") }), _jsx(ListCard, { items: vm.knowledge.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` })) })] }), _jsxs("div", { children: [_jsx("h4", { children: translateMessage("ui.missionConsole.section.learningRecords") }), _jsx(ListCard, { items: vm.learning.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` })) })] })] })] })] })] })), right: (_jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.runs") }), _jsx(ListCard, { items: vm.runs.map((run) => ({ title: run.title, description: run.status })) })] }), _jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.evidence") }), _jsx(ListCard, { items: vm.evidence.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` })) })] }), _jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.settings") }), _jsx(KeyValueTable, { rows: vm.missionSettings.map((item) => ({ key: item.key, value: item.value })) })] }), _jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.guardrails") }), _jsx(ListCard, { items: vm.operatorNotices })] }), _jsxs("section", { children: [_jsx("h3", { children: translateMessage("ui.missionConsole.section.actions") }), vm.actionErrorMessage == null ? null : _jsx("p", { style: { color: "#9f1239", margin: "0 0 12px 0" }, children: vm.actionErrorMessage }), _jsx(ListCard, { items: vm.recommendedActions.map((item) => ({
                                    title: item.title,
                                    description: item.description,
                                    ...(item.actionId == null
                                        ? {}
                                        : {
                                            actionLabel: vm.pendingActionId === item.actionId ? `${item.actionLabel ?? item.title}...` : (item.actionLabel ?? item.title),
                                            actionDisabled: vm.pendingActionId != null,
                                            onAction: () => vm.performAction(item.actionId),
                                        }),
                                })) })] })] })) })) }));
}
