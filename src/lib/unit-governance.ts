export type UnitCode = "ENG-1" | "ARCH-1" | "OPS-1" | "PROD-1" | "REV-1" | "GTM-1" | "GOV-1" | "CONTRA-1";
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
  worksWith?: string;
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
  "CONTRA-1": {
    code: "CONTRA-1",
    codename: "Wrench",
    emoji: "🧨",
    personality: "Skeptical, pattern-spotter, hates shiny objects, politely calls BS.",
    mission: "Prevent groupthink and Tier drift by stress-testing plans before execution.",
    authority: [
      "Request pause on initiatives for review",
      "Demand Tier proof before sprint acceptance",
      "Open mandatory Red Team Review items",
    ],
    cannot: ["Ship code", "Change roadmap unilaterally", "Approve deploys/outbound"],
    reportsTo: "PROD-1",
    worksWith: "PROD-1 + GOV-1 + OPS-1",
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

export type WrenchTrigger = {
  reason: string;
  lane: string;
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

export function detectWrenchTriggers(input: {
  hasTier1Backlog: boolean;
  proposesTier3: boolean;
  touchesSensitiveSurface: boolean;
  parallelEpics: number;
  hasUnmeasurableFeature: boolean;
}): WrenchTrigger[] {
  const triggers: WrenchTrigger[] = [];

  if (input.hasTier1Backlog && input.proposesTier3) {
    triggers.push({ reason: "Tier 3 proposed while Tier 1 backlog exists", lane: "Compass → Flow" });
  }
  if (input.touchesSensitiveSurface) {
    triggers.push({ reason: "Change touches auth/permissions/payments/deploy pipeline", lane: "Spine → Builder → Gatekeeper" });
  }
  if (input.parallelEpics > 2) {
    triggers.push({ reason: "Sprint has more than 2 parallel epics", lane: "Flow" });
  }
  if (input.hasUnmeasurableFeature) {
    triggers.push({ reason: "Feature request missing measurable outcome", lane: "Compass" });
  }

  return triggers;
}

export function responseEnvelope(
  unit: UnitCode,
  decision: string,
  rationale: string,
  risks: string,
  nextAction: string,
): string {
  const profile = UNIT_REGISTRY[unit];
  if (unit === "CONTRA-1") {
    return `[CONTRA-1 | Wrench]\nObjection: ${decision}\nEvidence: ${rationale}\nRisk if we proceed: ${risks}\nAlternative path: ${nextAction}\nMinimum safe experiment: Define a 48h constrained test with exit criteria.\nDecision recommendation: Pause until Tier proof is documented.`;
  }

  return `[${profile.code} | ${profile.codename}] Decision: ${decision}\nRationale: ${rationale}\nRisks: ${risks}\nNext Action: ${nextAction}`;
}
