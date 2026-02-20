import { GitHubLivePanel } from "@/components/hq/GitHubLivePanel";
import { RepoDependencyBoard } from "@/components/hq/RepoDependencyBoard";
import { TeamStructureScreen } from "@/components/hq/TeamStructureScreen";
import { UnitBoard } from "@/components/hq/UnitBoard";
import { getLiveOpsSnapshot } from "@/lib/live";

export default async function TeamPage() {
  const live = await getLiveOpsSnapshot();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Mission Control</p>
        <h1 className="mt-2 text-3xl font-semibold">Team</h1>
      </section>

      <TeamStructureScreen units={live.unitBoard.units} />

      <UnitBoard
        units={live.unitBoard.units}
        wrenchChips={live.unitBoard.wrenchChips}
        telegramFeed={live.unitBoard.telegramFeed}
      />

      <GitHubLivePanel
        openIssues={live.github.openIssues}
        openPrs={live.github.openPrs}
        status={live.github.status}
        error={live.github.error}
      />

      <RepoDependencyBoard repositories={live.repoGraph.repositories} dependencies={live.repoGraph.dependencies} />
    </div>
  );
}
