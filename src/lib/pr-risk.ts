type PRItem = { number: number; title: string; labels?: { name: string }[]; url: string };

export type PRRisk = "Low" | "Medium" | "High";

export type PRReadiness = {
  number: number;
  title: string;
  url: string;
  risk: PRRisk;
  reason: string;
};

export function scorePrReadiness(prs: PRItem[]): PRReadiness[] {
  return prs.map((pr) => {
    const labels = (pr.labels ?? []).map((l) => l.name.toLowerCase());
    const title = pr.title.toLowerCase();
    let risk: PRRisk = "Low";
    const reasons: string[] = [];

    if (labels.some((l) => l.includes("security")) || title.includes("auth") || title.includes("gateway")) {
      risk = "High";
      reasons.push("Security/auth/gateway-sensitive changes");
    } else if (labels.some((l) => l.includes("infra")) || title.includes("config") || title.includes("migration")) {
      risk = "Medium";
      reasons.push("Infra/config/migration impact");
    } else {
      reasons.push("No elevated risk indicators");
    }

    return { number: pr.number, title: pr.title, url: pr.url, risk, reason: reasons.join("; ") };
  });
}
