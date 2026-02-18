import { NextResponse, type NextRequest } from "next/server";

const writeRoles = new Set(["owner", "admin", "operator"]);

function roleFromRequest(req: NextRequest): string {
  return (
    req.headers.get("x-mc-role") ??
    req.headers.get("x-role") ??
    req.headers.get("x-user-role") ??
    "viewer"
  ).toLowerCase();
}

export function middleware(req: NextRequest) {
  if (req.method !== "PATCH") return NextResponse.next();

  if (!req.nextUrl.pathname.startsWith("/api/approvals/")) {
    return NextResponse.next();
  }

  const role = roleFromRequest(req);
  if (!writeRoles.has(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role for approval writes" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/approvals/:path*"],
};
