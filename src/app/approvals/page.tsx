import { ApprovalInbox } from "@/components/hq/ApprovalInbox";
import { PermissionsMatrix } from "@/components/hq/PermissionsMatrix";
import { PolicyGuardrails } from "@/components/hq/PolicyGuardrails";
import { getLiveOpsSnapshot } from "@/lib/live";

const rolePermissions = [
  { name: "Operator", deploy: "approval", message: "approval", purchase: "approval", repoWrite: "allowed" },
  { name: "Bug Engineer", deploy: "denied", message: "denied", purchase: "denied", repoWrite: "allowed" },
  { name: "Revenue Officer", deploy: "denied", message: "approval", purchase: "approval", repoWrite: "denied" },
  { name: "Marketing Operator", deploy: "denied", message: "approval", purchase: "approval", repoWrite: "denied" },
] as const;

export default async function ApprovalsPage() {
  const live = await getLiveOpsSnapshot();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Mission Control</p>
        <h1 className="mt-2 text-3xl font-semibold">Approvals</h1>
      </section>
      <ApprovalInbox approvals={live.approvals} />
      <PermissionsMatrix roles={[...rolePermissions]} />
      <PolicyGuardrails />
    </div>
  );
}
