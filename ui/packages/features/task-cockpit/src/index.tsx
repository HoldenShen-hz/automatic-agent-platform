import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";
import { useTasksQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "task-cockpit",
  title: "Task Cockpit",
  group: "Mission Control",
  path: "/mission-control/tasks",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: "任务五级下钻和三栏工作台基线。",
  render: () => {
    const query = useTasksQuery();
    return (
      <FeatureScaffold title="Task Cockpit" summary="任务五级下钻和三栏布局" status="Implemented/Contracted">
        <ListCard
          items={(query.data ?? []).map((task) => ({
            title: `${task.title} · ${task.status}`,
            description: `${task.domainId} / ${task.currentStep}`,
          }))}
        />
      </FeatureScaffold>
    );
  },
});
