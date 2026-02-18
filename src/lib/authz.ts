import type { NextRequest } from "next/server";

export type Role = "owner" | "admin" | "operator" | "viewer";

const writeRoles: Role[] = ["owner", "admin", "operator"];

function normalizeRole(value: string | null): Role {
  if (!value) return "viewer";
  const role = value.toLowerCase();
  if (role === "owner" || role === "admin" || role === "operator" || role === "viewer") return role;
  return "viewer";
}

export function getRequestRole(req: NextRequest): Role {
  return normalizeRole(
    req.headers.get("x-mc-role") ?? req.headers.get("x-role") ?? req.headers.get("x-user-role"),
  );
}

export function getActorIdentity(req: NextRequest): string {
  return (
    req.headers.get("x-mc-actor") ??
    req.headers.get("x-actor") ??
    req.headers.get("x-user") ??
    req.headers.get("x-user-id") ??
    "unknown"
  );
}

export function canWrite(role: Role): boolean {
  return writeRoles.includes(role);
}
