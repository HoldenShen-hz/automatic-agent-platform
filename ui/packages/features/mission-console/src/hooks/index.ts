import { useEffect, useState } from "react";
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
      { key: "Risk profile", value: mapped.selectedMission.riskProfileRef ?? "not configured" },
      { key: "Policy refs", value: String(mapped.selectedMission.policyRefs?.length ?? 0) },
      { key: "Knowledge boundary", value: mapped.selectedMission.knowledgeBoundaryRef ?? "default mission boundary" },
      { key: "Workflow templates", value: String(mapped.selectedMission.defaultWorkflowTemplateRefs?.length ?? 0) },
      { key: "Budget envelope", value: mapped.selectedMission.budgetEnvelopeRef ?? "not configured" },
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
      title: "High-risk actions require confirmation",
      description: "Freeze, complete, archive, and other high-risk writes must stay server-authorized and explicitly confirmed.",
    },
    {
      title: "Mission hint is not authorization",
      description: "Mission selection in UI remains advisory until MissionGovernance resolves permissions and policy.",
    },
  ];

  if (memberCount === 0) {
    notices.push({
      title: "Membership review required",
      description: "This mission currently exposes no active members in the console data view.",
    });
  }
  if (budget?.status !== "configured") {
    notices.push({
      title: "Budget envelope missing",
      description: "Budget-backed execution and cost attribution remain limited until a budget envelope is configured.",
    });
  }
  if (mission.status === "frozen" || mission.status === "archived") {
    notices.push({
      title: "Execution is guarded",
      description: `Mission status is ${mission.status}; runtime writes should fail closed through MissionLiveGuard.`,
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
      key: "Knowledge boundary",
      value: mission.knowledgeBoundaryRef ?? "default mission-local boundary",
    },
    {
      key: "Promotion mode",
      value: mission.status === "active" || mission.status === "paused"
        ? "mission-local by default; promotion requires approval + evidence"
        : "learning remains local while mission is not executable",
    },
    {
      key: "Knowledge assets",
      value: knowledgeCount > 0 ? `${knowledgeCount} mission-linked knowledge assets` : "no mission-linked knowledge assets",
    },
    {
      key: "Learning records",
      value: learningCount > 0 ? `${learningCount} learning records promoted or pending` : "no learning records linked yet",
    },
    {
      key: "Evidence backing",
      value: evidenceCount > 0 ? `${evidenceCount} evidence records attached` : "no evidence linked yet",
    },
    {
      key: "Workflow templates",
      value: `${mission.defaultWorkflowTemplateRefs?.length ?? 0} template refs bound`,
    },
  ];
}

function buildRecommendedActions(mission: MissionDTO): readonly { title: string; description: string }[] {
  switch (mission.status) {
    case "draft":
      return [
        { title: "Activate mission", description: "Move from draft into executable state after final objective and policy review." },
        { title: "Archive mission", description: "Close out unused drafts that should not remain selectable for task binding." },
      ];
    case "active":
      return [
        { title: "Pause mission", description: "Temporarily stop new work intake while preserving resumability." },
        { title: "Freeze mission", description: "Fail-close runtime execution when policy, risk, or budget conditions require a hard stop." },
        { title: "Complete mission", description: "Mark successful completion when acceptance criteria and evidence are satisfied." },
      ];
    case "paused":
      return [
        { title: "Resume mission", description: "Return to active execution after blockers are removed." },
        { title: "Freeze mission", description: "Escalate from paused to hard-stop when runtime write access must be revoked." },
        { title: "Archive mission", description: "Retire paused work that should not resume." },
      ];
    case "frozen":
      return [
        { title: "Unfreeze to paused", description: "Reopen governance review without immediately restoring execution rights." },
        { title: "Archive mission", description: "Permanently retire frozen missions after audit capture." },
      ];
    case "completed":
      return [
        { title: "Archive mission", description: "Finalize completed missions after outcome review, evidence export, and retention checks." },
      ];
    case "archived":
      return [
        { title: "Mission is terminal", description: "Archived missions stay read-only and should only be used for audit or historical review." },
      ];
    default:
      return [];
  }
}
