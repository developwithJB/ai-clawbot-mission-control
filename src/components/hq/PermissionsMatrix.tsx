type Role = {
  name: string;
  deploy: "allowed" | "approval" | "denied";
  message: "allowed" | "approval" | "denied";
  purchase: "allowed" | "approval" | "denied";
  repoWrite: "allowed" | "approval" | "denied";
};

function badge(v: Role["deploy"]) {
  if (v === "allowed") return "text-emerald-300";
  if (v === "approval") return "text-amber-300";
  return "text-rose-300";
}

export function PermissionsMatrix({ roles }: { roles: Role[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-lg font-semibold">Role Permissions Matrix</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="text-left py-2">Role</th>
              <th className="text-left py-2">Deploy</th>
              <th className="text-left py-2">Outbound Msg</th>
              <th className="text-left py-2">Purchase</th>
              <th className="text-left py-2">Repo Write</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.name} className="border-t border-zinc-800">
                <td className="py-2 text-zinc-100">{r.name}</td>
                <td className={`py-2 ${badge(r.deploy)}`}>{r.deploy}</td>
                <td className={`py-2 ${badge(r.message)}`}>{r.message}</td>
                <td className={`py-2 ${badge(r.purchase)}`}>{r.purchase}</td>
                <td className={`py-2 ${badge(r.repoWrite)}`}>{r.repoWrite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
