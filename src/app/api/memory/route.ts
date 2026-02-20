import { NextResponse } from "next/server";
import { listMemoryDocs } from "@/lib/memory";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const docs = await listMemoryDocs(q);
  return NextResponse.json({ docs });
}
