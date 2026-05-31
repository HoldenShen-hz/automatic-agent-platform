import { useEffect, useState } from "react";
import { translateMessage } from "@aa/shared-i18n";
import {
  fetchMissionBudget,
  fetchMissionEvidence,
  fetchMissionKnowledge,
  fetchMissionLearning,
  fetchMissionMembers,
  fetchMissionRuns,
  fetchMissionTasks,
} from "@aa/shared-api-client";
import { useMissionsQuery, useRestClient } from "@aa/shared-state";
import type { MissionBudgetSummaryDTO, MissionDTO, MissionMemberDTO, MissionResourceDTO } from "@aa/shared-types";

export interface MissionConsoleVm {
  readonly loading: boolean;
  readonly missions: readonly MissionDTO[];
  readonly selectedMission: MissionDTO | null;
  readonly selectedMissionId: string | null;
  readonly members: readonly MissionMemberDTO[];
  readonly tasks: readonly MissionResourceDTO[];
  readonly runs: readonly MissionResourceDTO[];
  readonly evidence: readonly MissionResourceDTO[];
  readonly knowledge: readonly MissionResourceDTO[];
  readonly learning: readonly MissionResourceDTO[];
  readonly budget: MissionBudgetSummaryDTO | null;
  readonly missionSettings: readonly { key: string; value: string }[];
  readonly knowledgeLearningSummary: readonly { key: string; value: string }[];
  readonly recommendedActions: readonly { title: string; description: string }[];
  readonly operatorNotices: readonly { title: string; description: string }[];
  selectMission(missionId: string): void;
}

export function mapMissionsToConsoleVm(missions: readonly MissionDTO[], selectedMissionId: string | null) {
  const selectedMission = missions.find((mission) => mission.missionId === selectedMissionId) ?? missions[0] ?? null;
  return {
    missions,
    selectedMission,
    selectedMissionId: selectedMission?.missionId ?? null,
  };
}

export function useMissionConsoleVm(): MissionConsoleVm {
  const client = useRestClient();
  const query = useMissionsQuery();
  const missions = query.data ?? [];
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [members, setMembers] = useState<readonly MissionMemberDTO[]>([]);
  const [tasks, setTasks] = useState<readonly MissionResourceDTO[]>([]);
  const [runs, setRuns] = useState<readonly MissionResourceDTO[]>([]);
  const [evidence, setEvidence] = useState<readonly MissionResourceDTO[]>([]);
  const [knowledge, setKnowledge] = useState<readonly MissionResourceDTO[]>([]);
  const [learning, setLearning] = useState<readonly MissionResourceDTO[]>([]);
  const [budget, setBudget] = useState<MissionBudgetSummaryDTO | null>(null);
  const mapped = mapMissionsToConsoleVm(missions, selectedMissionId);

  useEffect(() => {
    if (mapped.selectedMissionId == null) {
      setMembers([]);
      setTasks([]);
      setRuns([]);
      setEvidence([]);
      setKnowledge([]);
      setLearning([]);
      setBudget(null);
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetchMissionMembers(client, mapped.selectedMissionId),
      fetchMissionTasks(client, mapped.selectedMissionId),
      fetchMissionRuns(client, mapped.selectedMissionId),
      fetchMissionEvidence(client, mapped.selectedMissionId),
      fetchMissionKnowledge(client, mapped.selectedMissionId),
      fetchMissionLearning(client, mapped.selectedMissionId),
      fetchMissionBudget(client, mapped.selectedMissionId),
    ]).then(([nextMembers, nextTasks, nextRuns, nextEvidence, nextKnowledge, nextLearning, nextBudget]) => {
      if (!cancelled) {
        setMembers(nextMembers);
        setTasks(nextTasks);
        setRuns(nextRuns);
        setEvidence(nextEvidence);
        setKnowledge(nextKnowledge);
        setLearning(nextLearning);
        setBudget(nextBudget);
      }
    }).catch(() => {
      if (!cancelled) {
        setMembers([]);
        setTasks([]);
        setRuns([]);
        setEvidence([]);
        setKnowledge([]);
        setLearning([]);
        setBudget(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, mapped.selectedMissionId]);

  const missionSettings = mapped.selectedMission == null
    ? []
    : [
      { key: translateMessage("ui.missionConsole.settings.riskProfile"), value: mapped.selectedMission.riskProfileRef ?? translateMessage("ui.missionConsole.value.notConfigured") },
      { key: translateMessage("ui.missionConsole.settings.policyRefs"), value: String(mapped.selectedMission.policyRefs?.length ?? 0) },
      { key: translateMessage("ui.missionConsole.settings.knowledgeBoundary"), value: mapped.selectedMission.knowledgeBoundaryRef ?? translateMessage("ui.missionConsole.value.defaultBoundary") },
      { key: translateMessage("ui.missionConsole.settings.workflowTemplates"), value: String(mapped.selectedMission.defaultWorkflowTemplateRefs?.length ?? 0) },
      { key: translateMessage("ui.missionConsole.settings.budgetEnvelope"), value: mapped.selectedMission.budgetEnvelopeRef ?? translateMessage("ui.missionConsole.value.notConfigured") },
    ];

  const operatorNotices = mapped.selectedMission == null
    ? []
    : buildOperatorNotices(mapped.selectedMission, budget, members.length);
  const knowledgeLearningSummary = mapped.selectedMission == null
    ? []
    : buildKnowledgeLearningSummary(mapped.selectedMission, knowledge.length, learning.length, evidence.length);
  const recommendedActions = mapped.selectedMission == null
    ? []
    : buildRecommendedActions(mapped.selectedMission);

  return {
    loading: query.isLoading,
    ...mapped,
    members,
    tasks,
    runs,
    evidence,
    knowledge,
    learning,
    budget,
    missionSettings,
    knowledgeLearningSummary,
    recommendedActions,
    operatorNotices,
    selectMission: setSelectedMissionId,
  };
}

function buildOperatorNotices(
  mission: MissionDTO,
  budget: MissionBudgetSummaryDTO | null,
  memberCount: number,
): readonly { title: string; description: string }[] {
  const notices = [
    {
      title: translateMessage("ui.missionConsole.notice.confirmation.title"),
      description: translateMessage("ui.missionConsole.notice.confirmation.description"),
    },
    {
      title: translateMessage("ui.missionConsole.notice.authorization.title"),
      description: translateMessage("ui.missionConsole.notice.authorization.description"),
    },
  ];

  if (memberCount === 0) {
    notices.push({
      title: translateMessage("ui.missionConsole.notice.membership.title"),
      description: translateMessage("ui.missionConsole.notice.membership.description"),
    });
  }
  if (budget?.status !== "configured") {
    notices.push({
      title: translateMessage("ui.missionConsole.notice.budget.title"),
      description: translateMessage("ui.missionConsole.notice.budget.description"),
    });
  }
  if (mission.status === "frozen" || mission.status === "archived") {
    notices.push({
      title: translateMessage("ui.missionConsole.notice.executionGuard.title"),
      description: translateMessage("ui.missionConsole.notice.executionGuard.description", { status: mission.status }),
    });
  }

  return notices;
}

function buildKnowledgeLearningSummary(
  mission: MissionDTO,
  knowledgeCount: number,
  learningCount: number,
  evidenceCount: number,
): readonly { key: string; value: string }[] {
  return [
    {
      key: translateMessage("ui.missionConsole.summary.knowledgeBoundary"),
      value: mission.knowledgeBoundaryRef ?? translateMessage("ui.missionConsole.value.defaultMissionBoundary"),
    },
    {
      key: translateMessage("ui.missionConsole.summary.promotionMode"),
      value: mission.status === "active" || mission.status === "paused"
        ? translateMessage("ui.missionConsole.summary.promotionMode.active")
        : translateMessage("ui.missionConsole.summary.promotionMode.inactive"),
    },
    {
      key: translateMessage("ui.missionConsole.summary.knowledgeAssets"),
      value: knowledgeCount > 0
        ? translateMessage("ui.missionConsole.summary.knowledgeAssets.count", { count: knowledgeCount })
        : translateMessage("ui.missionConsole.summary.knowledgeAssets.empty"),
    },
    {
      key: translateMessage("ui.missionConsole.summary.learningRecords"),
      value: learningCount > 0
        ? translateMessage("ui.missionConsole.summary.learningRecords.count", { count: learningCount })
        : translateMessage("ui.missionConsole.summary.learningRecords.empty"),
    },
    {
      key: translateMessage("ui.missionConsole.summary.evidenceBacking"),
      value: evidenceCount > 0
        ? translateMessage("ui.missionConsole.summary.evidenceBacking.count", { count: evidenceCount })
        : translateMessage("ui.missionConsole.summary.evidenceBacking.empty"),
    },
    {
      key: translateMessage("ui.missionConsole.summary.workflowTemplates"),
      value: translateMessage("ui.missionConsole.summary.workflowTemplates.count", {
        count: mission.defaultWorkflowTemplateRefs?.length ?? 0,
      }),
    },
  ];
}

function buildRecommendedActions(mission: MissionDTO): readonly { title: string; description: string }[] {
  switch (mission.status) {
    case "draft":
      return [
        { title: translateMessage("ui.missionConsole.action.activate.title"), description: translateMessage("ui.missionConsole.action.activate.description") },
        { title: translateMessage("ui.missionConsole.action.archive.title"), description: translateMessage("ui.missionConsole.action.archive.draftDescription") },
      ];
    case "active":
      return [
        { title: translateMessage("ui.missionConsole.action.pause.title"), description: translateMessage("ui.missionConsole.action.pause.description") },
        { title: translateMessage("ui.missionConsole.action.freeze.title"), description: translateMessage("ui.missionConsole.action.freeze.description") },
        { title: translateMessage("ui.missionConsole.action.complete.title"), description: translateMessage("ui.missionConsole.action.complete.description") },
      ];
    case "paused":
      return [
        { title: translateMessage("ui.missionConsole.action.resume.title"), description: translateMessage("ui.missionConsole.action.resume.description") },
        { title: translateMessage("ui.missionConsole.action.freeze.title"), description: translateMessage("ui.missionConsole.action.freeze.pausedDescription") },
        { title: translateMessage("ui.missionConsole.action.archive.title"), description: translateMessage("ui.missionConsole.action.archive.pausedDescription") },
      ];
    case "frozen":
      return [
        { title: translateMessage("ui.missionConsole.action.unfreeze.title"), description: translateMessage("ui.missionConsole.action.unfreeze.description") },
        { title: translateMessage("ui.missionConsole.action.archive.title"), description: translateMessage("ui.missionConsole.action.archive.frozenDescription") },
      ];
    case "completed":
      return [
        { title: translateMessage("ui.missionConsole.action.archive.title"), description: translateMessage("ui.missionConsole.action.archive.completedDescription") },
      ];
    case "archived":
      return [
        { title: translateMessage("ui.missionConsole.action.terminal.title"), description: translateMessage("ui.missionConsole.action.terminal.description") },
      ];
    default:
      return [];
  }
}
