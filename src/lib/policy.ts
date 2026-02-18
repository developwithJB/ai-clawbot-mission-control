export type SensitiveAction = "deployment" | "outbound-message" | "purchase";

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
};

export function evaluatePolicy(action: SensitiveAction, approvedByHuman: boolean): PolicyDecision {
  if (approvedByHuman) {
    return { allowed: true, requiresApproval: false, reason: "Explicit human approval supplied" };
  }

  if (["deployment", "outbound-message", "purchase"].includes(action)) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: "Action requires explicit JB approval per Working Agreement v1",
    };
  }

  return { allowed: true, requiresApproval: false, reason: "Action allowed" };
}
