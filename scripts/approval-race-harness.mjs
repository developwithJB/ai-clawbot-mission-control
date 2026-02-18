#!/usr/bin/env node
/**
 * Tiny dev harness: simulate double-approve race and verify:
 * - one PATCH succeeds
 * - one PATCH gets 409 conflict
 * - conflict recovery via targeted GET /api/approvals/:id works
 * - approval_decided audit event is written with required metadata
 *
 * Usage:
 *   node scripts/approval-race-harness.mjs
 *   BASE_URL=http://localhost:3000 node scripts/approval-race-harness.mjs
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function getJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function patchApproval(id, status, version, actor) {
  const requestId = `race-${actor}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const traceId = `trace-${actor}-${Date.now()}`;

  const res = await fetch(`${BASE_URL}/api/approvals/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-mc-role": "operator",
      "x-mc-actor": actor,
      "x-request-id": requestId,
      "x-trace-id": traceId,
    },
    body: JSON.stringify({ status, version }),
  });

  const data = await res.json().catch(() => ({}));
  return { res, data, requestId, traceId, actor };
}

async function run() {
  console.log(`🧪 Running approval race harness against ${BASE_URL}`);

  const list = await getJson(`${BASE_URL}/api/approvals`);
  assert(list.res.ok, `GET /api/approvals failed (${list.res.status})`);
  const approvals = Array.isArray(list.data.approvals) ? list.data.approvals : [];

  const candidate = approvals.find((a) => a.status === "pending") ?? approvals[0];
  assert(candidate, "No approvals available to run race test.");

  const before = await getJson(`${BASE_URL}/api/approvals/${candidate.id}`);
  assert(before.res.ok, `GET /api/approvals/${candidate.id} failed (${before.res.status})`);

  const baseline = before.data.approval;
  assert(baseline?.id === candidate.id, "Baseline approval payload missing/invalid.");
  assert(Number.isInteger(baseline?.version), "Baseline approval.version missing.");

  console.log(`Target approval: ${baseline.id} (status=${baseline.status}, version=${baseline.version})`);

  const [r1, r2] = await Promise.all([
    patchApproval(baseline.id, "approved", baseline.version, "race-harness-A"),
    patchApproval(baseline.id, "approved", baseline.version, "race-harness-B"),
  ]);

  const statuses = [r1.res.status, r2.res.status].sort((a, b) => a - b);
  assert(statuses[0] === 200 && statuses[1] === 409, `Expected [200,409], got [${statuses.join(",")}]`);

  const winner = r1.res.status === 200 ? r1 : r2;
  const loser = r1.res.status === 409 ? r1 : r2;

  assert(winner.data?.approval?.id === baseline.id, "Winner response missing updated approval.");
  assert(
    winner.data?.approval?.version === baseline.version + 1,
    `Expected winner version ${baseline.version + 1}, got ${winner.data?.approval?.version}`,
  );

  assert(loser.data?.error === "Version conflict", "Loser response should be version conflict.");

  // Simulate UI targeted conflict recovery behavior
  const recovery = await getJson(`${BASE_URL}/api/approvals/${baseline.id}`);
  assert(recovery.res.ok, "Recovery GET failed.");
  assert(recovery.data?.approval?.id === baseline.id, "Recovery approval missing.");
  assert(
    recovery.data?.approval?.version === winner.data.approval.version,
    "Recovery approval did not return latest server version.",
  );

  // Verify append-only audit event exists with expected fields.
  const eventsRes = await getJson(`${BASE_URL}/api/events`);
  assert(eventsRes.res.ok, `GET /api/events failed (${eventsRes.res.status})`);
  const events = Array.isArray(eventsRes.data.events) ? eventsRes.data.events : [];

  const matchingEvent = events.find(
    (e) =>
      e.type === "approval_decided" &&
      e.approvalId === baseline.id &&
      e.newStatus === "approved" &&
      (e.decidedBy === "race-harness-A" || e.decidedBy === "race-harness-B"),
  );

  assert(matchingEvent, "No matching approval_decided event found.");
  assert(matchingEvent.previousStatus, "Event missing previousStatus.");
  assert(matchingEvent.decidedAt, "Event missing decidedAt.");
  assert(matchingEvent.requestId, "Event missing requestId.");
  assert(matchingEvent.traceId, "Event missing traceId.");

  console.log("✅ Race outcome verified: one 200 + one 409");
  console.log("✅ Targeted conflict recovery verified via GET /api/approvals/:id");
  console.log("✅ approval_decided audit event metadata verified");
  console.log("Done.");
}

run().catch((error) => {
  console.error("❌ Harness failed:", error.message);
  process.exit(1);
});
