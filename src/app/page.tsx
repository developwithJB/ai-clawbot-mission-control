import { ActivityFeed } from "@/components/hq/ActivityFeed";
import { ApprovalInbox } from "@/components/hq/ApprovalInbox";
import { EventTimeline } from "@/components/hq/EventTimeline";
import { GitHubLivePanel } from "@/components/hq/GitHubLivePanel";
import { RepoDependencyBoard } from "@/components/hq/RepoDependencyBoard";
import { LiveOpsControls } from "@/components/hq/LiveOpsControls";
import { OpsPulse } from "@/components/hq/OpsPulse";
import { PermissionsMatrix } from "@/components/hq/PermissionsMatrix";
import { TaskOrchestratorCard } from "@/components/hq/TaskOrchestratorCard";
import { PRReadinessBoard } from "@/components/hq/PRReadinessBoard";
import { PolicyGuardrails } from "@/components/hq/PolicyGuardrails";
import { HaushavnOnboardingCard } from "@/components/hq/HaushavnOnboardingCard";
import { getLiveOpsSnapshot } from "@/lib/live";

type Agent = {
  name: string;
  role: string;
  status: "Idle" | "Working" | "Needs Review";
  focus: string;
  risk: "Low" | "Medium" | "High";
};

type Pipeline = {
  id: "A" | "D" | "B" | "C";
  name: string;
  objective: string;
  status: "Active" | "Queued" | "Planned";
  owner: string;
  steps: string[];
};

const agents: Agent[] = [
  {
    name: "Operator",
    role: "Lead Operator / Orchestration",
    status: "Working",
    focus: "Routing execution across pipelines A → D → B → C",
    risk: "Low",
  },
  {
    name: "Bug Engineer",
    role: "Issue triage, patch plans, fix workflows",
    status: "Working",
    focus: "Pipeline A live: issue intake + execution board",
    risk: "Medium",
  },
  {
    name: "Revenue Officer",
    role: "Revenue experiments + funnel progression",
    status: "Idle",
    focus: "Queued after Operator Sprint Planner",
    risk: "Low",
  },
  {
    name: "Marketing Operator",
    role: "Content + channel distribution engine",
    status: "Idle",
    focus: "Queued after Revenue pipeline",
    risk: "Low",
  },
  {
    name: "Discovery Analyst",
    role: "CTO intel + strategic discovery",
    status: "Working",
    focus: "Support bug triage and sprint prioritization",
    risk: "Low",
  },
  {
    name: "QA & Security Sentinel",
    role: "Quality gates + security guardrails",
    status: "Needs Review",
    focus: "Approval matrix + safety checks for active workflows",
    risk: "Medium",
  },
];

const pipelines: Pipeline[] = [
  {
    id: "A",
    name: "Bug Engineer Pipeline",
    objective: "Issue → Repro → Plan → Patch → Verify → Ready for Review",
    status: "Active",
    owner: "Bug Engineer",
    steps: [
      "Ingest issues from target repo",
      "Auto-tag severity + impact + tier alignment",
      "Generate patch plan with acceptance criteria",
      "Execute in branch-safe workflow",
      "Run tests + quality checks",
      "Escalate for Operator/Human approval",
    ],
  },
  {
    id: "D",
    name: "Operator Sprint Planner",
    objective: "Convert priorities into weekly, measurable execution blocks",
    status: "Queued",
    owner: "Operator",
    steps: [
      "Rank work by Tier score and leverage",
      "Set sprint outcomes + checkpoints",
      "Assign owners + dependencies",
      "Surface blockers daily",
      "Track progress against target velocity",
    ],
  },
  {
    id: "B",
    name: "Revenue Officer Pipeline",
    objective: "Revenue hypothesis → experiment → conversion gain",
    status: "Planned",
    owner: "Revenue Officer",
    steps: [
      "Define offer and audience hypothesis",
      "Deploy funnel experiment",
      "Track conversion and CAC signals",
      "Recommend scale/kill decision",
    ],
  },
  {
    id: "C",
    name: "Marketing Pipeline",
    objective: "Message strategy → content engine → distribution loop",
    status: "Planned",
    owner: "Marketing Operator",
    steps: [
      "Build weekly content map",
      "Generate channel-specific assets",
      "Distribute and capture engagement",
      "Feed high-performing messages to revenue pipeline",
    ],
  },
];

const executionQueue = [
  {
    title: "Create issue intake board from repo",
    owner: "Bug Engineer",
    state: "Doing",
    alignment: "Tier 3 now; Tier 1 pattern for Haushavn later",
  },
  {
    title: "Define branch safety + approval gates",
    owner: "QA & Security Sentinel",
    state: "Review",
    alignment: "All tiers",
  },
  {
    title: "Draft sprint capacity model",
    owner: "Operator",
    state: "Queued",
    alignment: "Tier 1/2 leverage",
  },
];

type ReviewRisk = "Low" | "Medium" | "High";

const prReviewQueue: { title: string; risk: ReviewRisk; reviewUrl: string }[] = [
  {
    title: "feat: harden approval gate retry flow",
    risk: "High",
    reviewUrl: "https://github.com/developwithJB/thecontrollables/pull/118",
  },
  {
    title: "fix: normalize webhook payload parser",
    risk: "Medium",
    reviewUrl: "https://github.com/developwithJB/thecontrollables/pull/117",
  },
  {
    title: "chore: refresh mission control copy blocks",
    risk: "Low",
    reviewUrl: "https://github.com/developwithJB/thecontrollables/pull/116",
  },
];

const approvalGates = ["Deployments", "Outbound Messages", "Purchases"];
const weeklyWinCriteria = [
  "Haushavn MVP progress (12-week plan)",
  "Book sales or speaking/workshop bookings",
  "Faith impact: helped grow someone's relationship with Jesus",
];
const pipelineOrder = ["A · Bug Engineer", "D · Sprint Planner", "B · Revenue", "C · Marketing"];

const rolePermissions = [
  { name: "Operator", deploy: "approval", message: "approval", purchase: "approval", repoWrite: "allowed" },
  { name: "Bug Engineer", deploy: "denied", message: "denied", purchase: "denied", repoWrite: "allowed" },
  { name: "Revenue Officer", deploy: "denied", message: "approval", purchase: "approval", repoWrite: "denied" },
  { name: "Marketing Operator", deploy: "denied", message: "approval", purchase: "approval", repoWrite: "denied" },
] as const;

function badgeClass(status: Agent["status"]) {
  if (status === "Working") return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  if (status === "Needs Review") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  return "border-zinc-500/30 bg-zinc-500/15 text-zinc-300";
}

function pipelineClass(status: Pipeline["status"]) {
  if (status === "Active") return "border-emerald-500/30 bg-emerald-500/10";
  if (status === "Queued") return "border-sky-500/30 bg-sky-500/10";
  return "border-zinc-700 bg-zinc-900/40";
}

function reviewRiskClass(risk: ReviewRisk) {
  if (risk === "High") return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  if (risk === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export const revalidate = 60;

export default async function Home() {
  const live = await getLiveOpsSnapshot();
  const lastUpdated = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-10">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Mission Control</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">AI Team Headquarters ⚙️</h1>
          <p className="mt-3 max-w-4xl text-zinc-300">
            Active execution mode enabled. Pipeline order confirmed: <strong>A → D → B → C</strong>.
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Live snapshot refreshed: {lastUpdated} (America/Chicago)</p>
            <LiveOpsControls />
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Operator Quick Reference</h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              Active Contract · v1
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Approval Gates</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                {approvalGates.map((gate) => (
                  <li key={gate} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    {gate}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Weekly Win Criteria</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                {weeklyWinCriteria.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Pipeline Order</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pipelineOrder.map((pipeline) => (
                  <span
                    key={pipeline}
                    className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-300"
                  >
                    {pipeline}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </section>


        <OpsPulse events={live.events} approvals={live.approvals} />

        <TaskOrchestratorCard ranked={live.rankedTasks} />

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Execution Mode" value="Active Workflows" />
          <Stat label="Current Pipeline" value="A · Bug Engineer" />
          <Stat label="Next Pipeline" value="D · Sprint Planner" />
          <Stat label="Risk Posture" value="Guarded" />
        </section>

        <GitHubLivePanel
          openIssues={live.github.openIssues}
          openPrs={live.github.openPrs}
          status={live.github.status}
          error={live.github.error}
        />

        <section className="grid gap-4 md:grid-cols-2">
          <ApprovalInbox approvals={live.approvals} />
          <ActivityFeed shippedToday={live.shippedToday} top3={live.top3} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold">Pipeline Roadmap</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pipelines.map((pipeline) => (
              <article key={pipeline.id} className={`rounded-xl border p-4 ${pipelineClass(pipeline.status)}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Pipeline {pipeline.id}</p>
                  <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{pipeline.status}</span>
                </div>
                <h3 className="mt-2 font-semibold">{pipeline.name}</h3>
                <p className="mt-1 text-sm text-zinc-300">{pipeline.objective}</p>
                <p className="mt-2 text-xs text-zinc-400">Owner: {pipeline.owner}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
                  {pipeline.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold">Agent Live View</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {agents.map((agent) => (
              <article key={agent.name} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-sm text-zinc-400">{agent.role}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs ${badgeClass(agent.status)}`}>{agent.status}</span>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{agent.focus}</p>
                <p className="mt-2 text-xs text-zinc-400">Risk: {agent.risk}</p>
              </article>
            ))}
          </div>
        </section>

        <RepoDependencyBoard
          repositories={live.repoGraph.repositories}
          dependencies={live.repoGraph.dependencies}
        />

        <PermissionsMatrix roles={[...rolePermissions]} />

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-lg font-semibold">Execution Queue</h2>
            <div className="mt-4 space-y-3">
              {executionQueue.map((task) => (
                <div key={task.title} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="font-medium">{task.title}</p>
                  <div className="mt-2 text-sm text-zinc-300">
                    <p>Owner: {task.owner}</p>
                    <p>State: {task.state}</p>
                    <p>Alignment: {task.alignment}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-lg font-semibold">PR Review Queue</h2>
            <div className="mt-4 space-y-2">
              {prReviewQueue.map((pr) => (
                <div key={pr.title} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">{pr.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${reviewRiskClass(pr.risk)}`}>
                      {pr.risk}
                    </span>
                  </div>
                  <a
                    className="mt-2 inline-block text-xs text-sky-300 hover:text-sky-200 hover:underline"
                    href={pr.reviewUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Review PR
                  </a>
                </div>
              ))}
            </div>
          </article>
        </section>

        <PRReadinessBoard prs={live.prReadiness} />

        <PolicyGuardrails />

        <HaushavnOnboardingCard />

        <EventTimeline events={live.events} />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Always-available decision trail: <code className="rounded bg-zinc-950 px-2 py-1">mission-control/docs/audit/decision-log.md</code>
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
            <li>Decision 001: Execute Day 1→3 as safe drafts pending approval.</li>
            <li>Decision 002: `needs-review` label introduced for governance gate.</li>
            <li>Decision 003: Persistent local audit file established.</li>
            <li>Decision 004: Event timeline surface added for collaborative visibility.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-100">{value}</p>
    </article>
  );
}
