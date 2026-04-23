export interface WorkflowBuilderVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useWorkflowBuilderVm(): WorkflowBuilderVm {
  return {
    items: [
      { title: "Node Palette", description: "Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release" },
      { title: "Canvas", description: "React Flow seam reserved for drag, connect, validate, publish." },
      { title: "Validation", description: "Schema + policy + runtime checks surface as planned seam." },
    ],
  };
}
