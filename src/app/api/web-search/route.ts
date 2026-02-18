import { NextRequest, NextResponse } from "next/server";
import { runWebSearch } from "@/lib/services/webSearchService";

type SearchBody = {
  query?: string;
  count?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SearchBody;
    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const result = await runWebSearch(body.query, body.count ?? 5);
    return NextResponse.json(result, { status: result.statusCode });
  } catch {
    return NextResponse.json({ error: "web search failed" }, { status: 500 });
  }
}
