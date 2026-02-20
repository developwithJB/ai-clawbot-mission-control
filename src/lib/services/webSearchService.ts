import { appendEvent } from "@/lib/services/eventService";

export type WebSearchProvider = "brave";

export type WebSearchResult = {
  title: string;
  url: string;
  description?: string;
};

export type WebSearchResponse = {
  provider: WebSearchProvider;
  query: string;
  timestamp: string;
  statusCode: number;
  results: WebSearchResult[];
};

function sanitizeQuery(input: string): string {
  return input.trim().slice(0, 240);
}

function logWebSearchEvent(params: {
  provider: WebSearchProvider;
  query: string;
  timestamp: string;
  statusCode: number;
  resultCount: number;
}) {
  appendEvent({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agent: "Operator",
    pipeline: "D",
    type: "integration",
    summary: `WEB_SEARCH provider=${params.provider} query="${params.query}" status=${params.statusCode} results=${params.resultCount}`,
    timestamp: params.timestamp,
  });
}

export async function runWebSearch(queryRaw: string, count = 5): Promise<WebSearchResponse> {
  const query = sanitizeQuery(queryRaw);
  const timestamp = new Date().toISOString();
  const provider: WebSearchProvider = "brave";

  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    logWebSearchEvent({ provider, query, timestamp, statusCode: 500, resultCount: 0 });
    return { provider, query, timestamp, statusCode: 500, results: [] };
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.max(1, Math.min(10, Math.floor(count)))));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  let results: WebSearchResult[] = [];
  if (res.ok) {
    const data = (await res.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    results = (data.web?.results ?? [])
      .filter((r) => Boolean(r.title && r.url))
      .map((r) => ({ title: r.title!, url: r.url!, description: r.description }));
  }

  logWebSearchEvent({
    provider,
    query,
    timestamp,
    statusCode: res.status,
    resultCount: results.length,
  });

  return {
    provider,
    query,
    timestamp,
    statusCode: res.status,
    results,
  };
}
