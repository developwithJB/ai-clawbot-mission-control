import { LiveOpsControls } from "@/components/hq/LiveOpsControls";
import { OpsPulse } from "@/components/hq/OpsPulse";
import { TaskOrchestratorCard } from "@/components/hq/TaskOrchestratorCard";
import { PRReadinessBoard } from "@/components/hq/PRReadinessBoard";
import { PolicyGuardrails } from "@/components/hq/PolicyGuardrails";
import { UnitSystemCard } from "@/components/hq/UnitSystemCard";
import { ResourceLedgerPanel } from "@/components/hq/ResourceLedgerPanel";
import { getLiveOpsSnapshot } from "@/lib/live";
import { readTasks } from "@/lib/tasks";

type Pipeline = {
  id: "A" | "D" | "B" | "C";
  name: string;
  objective: string;
  status: "Active" | "Queued" | "Planned";
  owner: string;
};

const pipelines: Pipeline[] = [
  { id: "A", name: "Bug Engineer Pipeline", objective: "Issue → Repro → Plan → Patch → Verify → Ready", status: "Active", owner: "Bug Engineer" },
  { id: "D", name: "Operator Sprint Planner", objective: "Priorities → measurable execution blocks", status: "Queued", owner: "Operator" },
  { id: "B", name: "Revenue Officer Pipeline", objective: "Hypothesis → experiment → conversion gain", status: "Planned", owner: "Revenue Officer" },
  { id: "C", name: "Marketing Pipeline", objective: "Message strategy → content engine → loop", status: "Planned", owner: "Marketing Operator" },
];

function pipelineClass(status: Pipeline["status"]) {
  if (status === "Active") return "border-emerald-500/30 bg-emerald-500/10";
  if (status === "Queued") return "border-sky-500/30 bg-sky-500/10";
  return "border-zinc-700 bg-zinc-900/40";
}

export default async function TasksPage() {
  const [live, initialTasks] = await Promise.all([getLiveOpsSnapshot(), readTasks()]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Mission Control</p>
        <h1 className="mt-2 text-3xl font-semibold">Tasks</h1>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-zinc-400">Execution and sprint flow for active lanes.</p>
          <LiveOpsControls />
        </div>
      </header>

      <OpsPulse events={live.events} approvals={live.approvals} />
      <TaskOrchestratorCard initialTasks={initialTasks} />
      <UnitSystemCard />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-lg font-semibold">Pipeline Roadmap</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {pipelines.map((pipeline) => (
            <article key={pipeline.id} className={`rounded-xl border p-4 ${pipelineClass(pipeline.status)}`}>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Pipeline {pipeline.id}</p>
              <h3 className="mt-2 font-semibold">{pipeline.name}</h3>
              <p className="mt-1 text-sm text-zinc-300">{pipeline.objective}</p>
              <p className="mt-2 text-xs text-zinc-400">Owner: {pipeline.owner}</p>
            </article>
          ))}
        </div>
      </section>

      <ResourceLedgerPanel ledger={live.resourceLedger} />
      <PRReadinessBoard prs={live.prReadiness} />
      <PolicyGuardrails />
    </div>
  );
}
