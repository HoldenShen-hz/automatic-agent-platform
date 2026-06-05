import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkflowBuilderDrafts } from "@aa/shared-api-client";
import { translateMessage } from "@aa/shared-i18n";
import { useAuthState, useRestClient, useWorkflowsQuery } from "@aa/shared-state";
const PHASE_Y_POSITION = {
    Observe: 24,
    Assess: 120,
    Plan: 216,
    Execute: 312,
    Feedback: 408,
    Learn: 504,
    Improve: 600,
    Release: 696,
};
function buildMutationHeaders(prefix) {
    const key = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `${prefix}-${crypto.randomUUID()}`
        : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return new Headers({
        "content-type": "application/json",
        "Accept-Version": "2026-04-01,2026-01-01",
        "Idempotency-Key": key,
    });
}
function mapDraftToNodes(draft) {
    if (draft == null) {
        return [];
    }
    return draft.builder.canvas.nodes.map((node, index) => ({
        id: node.nodeId,
        position: {
            x: index * 180,
            y: PHASE_Y_POSITION[resolvePhase(node.label, index)],
        },
        data: {
            label: node.label,
        },
        type: "default",
    }));
}
function mapDraftToEdges(draft) {
    if (draft == null) {
        return [];
    }
    return draft.builder.canvas.edges.map((edge) => ({
        id: `${edge.fromNodeId}->${edge.toNodeId}`,
        source: edge.fromNodeId,
        target: edge.toNodeId,
    }));
}
function resolvePhase(label, index) {
    const match = label.match(/^(Observe|Assess|Plan|Execute|Feedback|Learn|Improve|Release)\b/i)?.[1];
    if (match === "Observe" || match === "Assess" || match === "Plan" || match === "Execute" || match === "Feedback" || match === "Learn" || match === "Improve" || match === "Release") {
        return match;
    }
    const orderedPhases = ["Observe", "Assess", "Plan", "Execute", "Feedback", "Learn", "Improve", "Release"];
    return orderedPhases[Math.min(index, orderedPhases.length - 1)] ?? "Plan";
}
export function buildWorkflowBuilderSeed(workflows) {
    const sourceWorkflow = workflows[0] ?? null;
    const sourceSteps = sourceWorkflow?.steps?.length
        ? sourceWorkflow.steps
        : [
            { id: "observe", title: "Observe", phase: "Observe", status: "completed" },
            { id: "plan", title: "Plan", phase: "Plan", status: "running", dependsOnStepIds: ["observe"] },
            { id: "execute", title: "Execute", phase: "Execute", status: "pending", dependsOnStepIds: ["plan"] },
        ];
    const nodes = sourceSteps.map((step) => ({
        nodeId: step.id,
        componentId: `component:${step.phase.toLowerCase()}`,
        label: `${step.phase} · ${step.title}`,
    }));
    const dependencyEdges = sourceSteps.flatMap((step) => (step.dependsOnStepIds ?? []).map((dependencyId) => ({
        fromNodeId: dependencyId,
        toNodeId: step.id,
    })));
    const edges = dependencyEdges.length > 0
        ? dependencyEdges
        : sourceSteps.slice(1).map((step, index) => ({
            fromNodeId: sourceSteps[index].id,
            toNodeId: step.id,
        }));
    return {
        canvas: { nodes, edges },
        componentPalette: [
            {
                category: "action",
                components: nodes.map((node) => ({
                    componentId: node.componentId,
                    name: node.label,
                    icon: "workflow",
                    domainId: sourceWorkflow?.id ?? "platform",
                    riskLevel: "medium",
                    configSchema: {},
                    previewDescription: node.label,
                })),
            },
        ],
        livePreview: {
            estimatedDuration: `${Math.max(5, sourceSteps.length * 5)} min`,
            estimatedCost: `$${(Math.max(1, sourceSteps.length) * 0.03).toFixed(2)}`,
            riskAssessment: sourceWorkflow?.status === "failed" ? "needs_review" : "ready",
            stepByStepDescription: sourceSteps.map((step) => `${step.phase} · ${step.title}`),
        },
        validation: {
            valid: nodes.length > 0,
            messages: nodes.length > 0 ? [] : ["workflow_builder.empty"],
        },
        progressiveDisclosure: {
            level: "guided",
            hiddenCategories: [],
            defaultExpandedCategories: ["action"],
        },
    };
}
export function useWorkflowBuilderVm() {
    const client = useRestClient();
    const accessToken = useAuthState((state) => state.accessToken);
    const queryClient = useQueryClient();
    const workflows = useWorkflowsQuery().data ?? [];
    const draftsQuery = useQuery({
        queryKey: ["workflow-builder-drafts"],
        queryFn: () => fetchWorkflowBuilderDrafts(client),
    });
    const drafts = draftsQuery.data ?? [];
    const [selectedDraftId, setSelectedDraftId] = useState(null);
    const [draftTitle, setDraftTitle] = useState("");
    const [statusMessage, setStatusMessage] = useState(null);
    const [isMutating, setIsMutating] = useState(false);
    useEffect(() => {
        if (drafts.length === 0) {
            setSelectedDraftId(null);
            return;
        }
        if (selectedDraftId == null || !drafts.some((draft) => draft.draftId === selectedDraftId)) {
            setSelectedDraftId(drafts[0].draftId);
        }
    }, [drafts, selectedDraftId]);
    const selectedDraft = useMemo(() => drafts.find((draft) => draft.draftId === selectedDraftId) ?? null, [drafts, selectedDraftId]);
    useEffect(() => {
        setDraftTitle(selectedDraft?.title ?? "");
    }, [selectedDraft?.draftId, selectedDraft?.title]);
    const items = useMemo(() => {
        if (selectedDraft == null) {
            return [
                {
                    title: translateMessage("ui.workflowBuilder.empty.title"),
                    description: translateMessage("ui.workflowBuilder.empty.description"),
                },
            ];
        }
        return [
            {
                title: translateMessage("ui.workflowBuilder.summary.workflow.title"),
                description: `${selectedDraft.title} · ${selectedDraft.draftId}`,
            },
            {
                title: translateMessage("ui.workflowBuilder.summary.steps.title"),
                description: translateMessage("ui.workflowBuilder.summary.steps.description", {
                    count: selectedDraft.builder.canvas.nodes.length,
                }),
            },
            {
                title: translateMessage("ui.workflowBuilder.summary.governance.title"),
                description: `${selectedDraft.builder.validation.valid ? "valid" : "invalid"} · ${selectedDraft.updatedAt}`,
            },
        ];
    }, [selectedDraft]);
    return {
        items,
        drafts: drafts.map((draft) => ({
            draftId: draft.draftId,
            title: draft.title,
            updatedAt: draft.updatedAt,
        })),
        selectedDraftId,
        draftTitle,
        nodes: mapDraftToNodes(selectedDraft),
        edges: mapDraftToEdges(selectedDraft),
        validationMessages: selectedDraft?.builder.validation.messages ?? [],
        statusMessage,
        isMutating,
        canSave: selectedDraft != null && draftTitle.trim().length > 0 && !isMutating,
        canDelete: selectedDraft != null && !isMutating,
        setSelectedDraftId,
        setDraftTitle,
        async createDraft() {
            setIsMutating(true);
            setStatusMessage(null);
            try {
                const headers = buildMutationHeaders("workflow-builder-create");
                if (accessToken.length > 0) {
                    headers.set("authorization", `Bearer ${accessToken}`);
                }
                const response = await fetch("/api/v1/workflows/builder", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        title: `${workflows[0]?.title ?? "Workflow"} draft`,
                        builder: buildWorkflowBuilderSeed(workflows),
                    }),
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => null);
                    throw new Error(payload?.error?.message ?? `workflow_builder.create_failed:${response.status}`);
                }
                const created = (await response.json());
                await queryClient.invalidateQueries({ queryKey: ["workflow-builder-drafts"] });
                setSelectedDraftId(created.data.draftId);
                setStatusMessage(`Draft ${created.data.draftId} created.`);
            }
            catch (error) {
                setStatusMessage(error instanceof Error ? error.message : "workflow_builder.create_failed");
            }
            finally {
                setIsMutating(false);
            }
        },
        async saveDraft() {
            if (selectedDraft == null) {
                return;
            }
            setIsMutating(true);
            setStatusMessage(null);
            try {
                const headers = buildMutationHeaders("workflow-builder-save");
                if (accessToken.length > 0) {
                    headers.set("authorization", `Bearer ${accessToken}`);
                }
                const response = await fetch(`/api/v1/workflows/builder/${selectedDraft.draftId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        title: draftTitle.trim(),
                        builder: selectedDraft.builder,
                    }),
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => null);
                    throw new Error(payload?.error?.message ?? `workflow_builder.save_failed:${response.status}`);
                }
                const updated = (await response.json());
                await queryClient.invalidateQueries({ queryKey: ["workflow-builder-drafts"] });
                setDraftTitle(updated.data.title);
                setStatusMessage(`Draft ${updated.data.draftId} saved.`);
            }
            catch (error) {
                setStatusMessage(error instanceof Error ? error.message : "workflow_builder.save_failed");
            }
            finally {
                setIsMutating(false);
            }
        },
        async deleteDraft() {
            if (selectedDraft == null) {
                return;
            }
            setIsMutating(true);
            setStatusMessage(null);
            try {
                const deletedDraftId = selectedDraft.draftId;
                const headers = buildMutationHeaders("workflow-builder-delete");
                if (accessToken.length > 0) {
                    headers.set("authorization", `Bearer ${accessToken}`);
                }
                const response = await fetch(`/api/v1/workflows/builder/${deletedDraftId}`, {
                    method: "DELETE",
                    headers,
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => null);
                    throw new Error(payload?.error?.message ?? `workflow_builder.delete_failed:${response.status}`);
                }
                await queryClient.invalidateQueries({ queryKey: ["workflow-builder-drafts"] });
                setSelectedDraftId(null);
                setStatusMessage(`Draft ${deletedDraftId} deleted.`);
            }
            catch (error) {
                setStatusMessage(error instanceof Error ? error.message : "workflow_builder.delete_failed");
            }
            finally {
                setIsMutating(false);
            }
        },
    };
}
