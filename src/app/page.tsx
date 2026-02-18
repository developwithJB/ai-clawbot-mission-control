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
import { UnitSystemCard } from "@/components/hq/UnitSystemCard";
import { UnitBoard } from "@/components/hq/UnitBoard";
import { getLiveOpsSnapshot } from "@/lib/live";

const views = ["overview", "decisions", "execution", "governance", "intel"] as const;
type View = (typeof views)[number];

const rolePermissions = [
  { name: "Operator", deploy: "approval", message: "approval", purchase: "approval", repoWrite: "allowed" },
  { name: "Bug Engineer", deploy: "denied", message: "denied", purchase: "denied", repoWrite: "allowed" },
  { name: "Revenue Officer", deploy: "denied", message: "approval", purchase: "approval", repoWrite: "denied" },
  { name: "Marketing Operator", deploy: "denied", message: "approval", purchase: "approval", repoWrite: "denied" },
] as const;

export const revalidate = 30;

function normalizeView(value?: string): View {
  if (!value) return "overview";
  return (views.includes(value as View) ? value : "overview") as View;
}

function TabLink({ label, value, current }: { label: string; value: View; current: View }) {
  const active = current === value;
  return (
    <a
      href={`/?view=${value}`}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-sky-500/40 bg-sky-500/15 text-sky-200"
          : "border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {label}
    </a>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const live = await getLiveOpsSnapshot();
  const { view: rawView } = await searchParams;
  const view = normalizeView(rawView);

  const pendingApprovals = live.approvals.filter((a) => a.status === "pending");
  const blockedTasks = live.rankedTasks.filter((t) => t.status === "blocked");
  const tier1Tasks = live.rankedTasks.filter((t) => t.tier === "Tier 1" && t.status !== "done");
  const topAsk = pendingApprovals[0];

  const jbAsks = [
    topAsk ? `Approve or reject: ${topAsk.item}` : null,
    blockedTasks[0] ? `Unblock ${blockedTasks[0].title} (owner: ${blockedTasks[0].owner})` : null,
    live.unitBoard.wrenchChips[0] ? `Answer Wrench objection: ${live.unitBoard.wrenchChips[0].reason}` : null,
  ].filter(Boolean) as string[];

  const doneRecently = live.events.slice(0, 3).map((e) => e.summary);
  const nextUp = live.rankedTasks.filter((t) => ["planned", "doing", "review"].includes(t.status)).slice(0, 3);

  const lastUpdated = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-10">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Mission Control</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Operator Landing</h1>
          <p className="mt-2 max-w-4xl text-sm text-zinc-300">
            Default view shows only high-signal, need-to-know items and asks for JB. Everything else is intentionally behind tabs.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Updated: {lastUpdated} (America/Chicago)</p>
            <LiveOpsControls />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <TabLink label="Overview" value="overview" current={view} />
            <TabLink label="Decisions" value="decisions" current={view} />
            <TabLink label="Execution" value="execution" current={view} />
            <TabLink label="Governance" value="governance" current={view} />
            <TabLink label="Intel" value="intel" current={view} />
          </div>
        </header>

        {view === "overview" ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Stat label="Tier 1 Active" value={`${tier1Tasks.length}`} tone="default" />
              <Stat label="Approvals Pending" value={`${pendingApprovals.length}`} tone={pendingApprovals.length > 0 ? "warn" : "ok"} />
              <Stat label="Wrench Objections" value={`${live.unitBoard.wrenchChips.length}`} tone={live.unitBoard.wrenchChips.length > 0 ? "warn" : "ok"} />
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold">Asks for JB (right now)</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                {jbAsks.length === 0 ? <li className="text-zinc-400">No immediate asks. Team is executing.</li> : null}
                {jbAsks.map((ask) => (
                  <li key={ask} className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2">• {ask}</li>
                ))}
              </ul>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <h2 className="text-lg font-semibold">Done recently</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {doneRecently.map((item, idx) => (
                    <li key={`${item}-${idx}`} className="rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2">{item}</li>
                  ))}
                </ul>
              </article>
              <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <h2 className="text-lg font-semibold">Next up</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {nextUp.map((task) => (
                    <li key={task.id} className="rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                      {task.title}
                      <span className="ml-2 text-xs text-zinc-500">({task.tier} · {task.status})</span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <UnitBoard units={live.unitBoard.units} wrenchChips={live.unitBoard.wrenchChips} telegramFeed={live.unitBoard.telegramFeed} />
          </>
        ) : null}

        {view === "decisions" ? (
          <section className="grid gap-4 md:grid-cols-2">
            <ApprovalInbox approvals={live.approvals} />
            <EventTimeline events={live.events} />
          </section>
        ) : null}

        {view === "execution" ? (
          <>
            <OpsPulse events={live.events} approvals={live.approvals} />
            <TaskOrchestratorCard ranked={live.rankedTasks} />
            <PRReadinessBoard prs={live.prReadiness} />
            <ActivityFeed shippedToday={live.shippedToday} top3={live.top3} />
          </>
        ) : null}

        {view === "governance" ? (
          <>
            <UnitSystemCard />
            <PolicyGuardrails />
            <PermissionsMatrix roles={[...rolePermissions]} />
          </>
        ) : null}

        {view === "intel" ? (
          <>
            <GitHubLivePanel
              openIssues={live.github.openIssues}
              openPrs={live.github.openPrs}
              status={live.github.status}
              error={live.github.error}
            />
            <RepoDependencyBoard repositories={live.repoGraph.repositories} dependencies={live.repoGraph.dependencies} />
          </>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "default" | "warn" | "ok" }) {
  const toneClass =
    tone === "warn"
      ? "text-amber-200 border-amber-700/40"
      : tone === "ok"
        ? "text-emerald-200 border-emerald-700/40"
        : "text-zinc-100 border-zinc-800";

  return (
    <article className={`rounded-2xl border bg-zinc-900/60 p-5 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
