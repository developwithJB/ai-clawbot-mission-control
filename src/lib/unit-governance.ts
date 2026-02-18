export type UnitCode = "ENG-1" | "ARCH-1" | "OPS-1" | "PROD-1" | "REV-1" | "GTM-1" | "GOV-1";
export type Tier = 1 | 2 | 3;
export type Impact = "Revenue" | "Stability" | "Growth" | "Governance";
export type Risk = "Low" | "Medium" | "High";

export type UnitProfile = {
  code: UnitCode;
  codename: string;
  emoji: string;
  personality: string;
  mission: string;
  authority: string[];
  cannot: string[];
  reportsTo: string;
  vetoPower?: string;
};

export const UNIT_REGISTRY: Record<UnitCode, UnitProfile> = {
  "ENG-1": {
    code: "ENG-1",
    codename: "Builder",
    emoji: "🔨",
    personality: "Practical, focused, hates bugs, obsessed with clean delivery.",
    mission: "Build, fix, refactor, and ship safely.",
    authority: ["Code changes", "Bug fixes", "Performance improvements"],
    cannot: ["Change roadmap", "Deploy without approval", "Alter architecture direction"],
    reportsTo: "ARCH-1 + OPS-1",
  },
  "ARCH-1": {
    code: "ARCH-1",
    codename: "Spine",
    emoji: "🧬",
    personality: "Long-term thinker, protective of structure, skeptical of shortcuts.",
    mission: "Own system design integrity and scalability.",
    authority: ["Database schema", "Service boundaries", "Dependency architecture", "Infrastructure roadmap"],
    cannot: ["Introduce features independently", "Override Tier priorities"],
    reportsTo: "PROD-1 + OPS-1",
    vetoPower: "May block ENG-1 changes that violate architecture integrity.",
  },
  "OPS-1": {
    code: "OPS-1",
    codename: "Flow",
    emoji: "🌊",
    personality: "Organized, decisive, hates bottlenecks.",
    mission: "Translate Tier priorities into sprint plans.",
    authority: ["Sprint sequencing", "Task orchestration", "Pipeline enforcement (A → D → B → C)"],
    cannot: ["Override Tier ranking", "Approve deployments", "Modify governance rules"],
    reportsTo: "PROD-1",
  },
  "PROD-1": {
    code: "PROD-1",
    codename: "Compass",
    emoji: "🧭",
    personality: "Calm, strategic, asks: 'Does this move Tier 1?'",
    mission: "Defend focus and protect priority ladder.",
    authority: ["Roadmap approval", "Feature tradeoffs", "Priority scoring"],
    cannot: ["Ship code", "Override governance"],
    reportsTo: "JB",
    vetoPower: "May reject new work that does not move Tier 1.",
  },
  "REV-1": {
    code: "REV-1",
    codename: "Monetizer",
    emoji: "💰",
    personality: "Opportunity-driven, analytical, pragmatic.",
    mission: "Ensure monetization alignment.",
    authority: ["Revenue modeling", "Offer structure", "Pricing experiments"],
    cannot: ["Override Tier priorities", "Trigger outbound without approval gate"],
    reportsTo: "PROD-1",
  },
  "GTM-1": {
    code: "GTM-1",
    codename: "Amplifier",
    emoji: "📣",
    personality: "Creative, persuasive, energetic.",
    mission: "Amplify shipped value.",
    authority: ["Campaign execution", "Messaging strategy", "Distribution planning"],
    cannot: ["Launch outbound without GOV-1 approval", "Announce unshipped features"],
    reportsTo: "REV-1",
  },
  "GOV-1": {
    code: "GOV-1",
    codename: "Gatekeeper",
    emoji: "🛡",
    personality: "Protective, skeptical, rule-driven.",
    mission: "Protect system integrity and enforce approval gates.",
    authority: ["Enforce approval requirements", "Audit decision logs", "Block unsafe actions"],
    cannot: ["Override strategic priorities set by JB"],
    reportsTo: "JB",
  },
};

export const APPROVAL_REQUIRED_ACTIONS = [
  "deployments",
  "outbound messaging",
  "purchases",
  "system-wide config changes",
] as const;

export type GovernanceAction = {
  title: string;
  owner: UnitCode;
  tier: Tier;
  impact: Impact;
  risk: Risk;
};

export type GovernanceDecision = {
  allowed: boolean;
  reason: string;
};

export function evaluateTierGuard(action: GovernanceAction, hasTier1Backlog: boolean): GovernanceDecision {
  if (hasTier1Backlog && action.tier === 3) {
    return {
      allowed: false,
      reason: "Tier 3 work blocked while Tier 1 backlog exists.",
    };
  }

  return { allowed: true, reason: "Tier policy satisfied." };
}

export function responseEnvelope(unit: UnitCode, decision: string, rationale: string, risks: string, nextAction: string): string {
  const profile = UNIT_REGISTRY[unit];
  return `[${profile.code} | ${profile.codename}] Decision: ${decision}\nRationale: ${rationale}\nRisks: ${risks}\nNext Action: ${nextAction}`;
}
