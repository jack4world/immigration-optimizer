import type { Config } from '../data/config.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string, config: Config): Promise<SearchResult[]> {
  const api = config.search_api;
  if (!api?.api_key || !api?.provider) return [];

  if (api.provider === 'tavily') {
    return tavilySearch(query, api.api_key);
  }
  if (api.provider === 'serper') {
    return serperSearch(query, api.api_key);
  }
  if (api.provider === 'brave') {
    return braveSearch(query, api.api_key);
  }

  return [];
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function tavilySearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const resp = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 8,
      include_answer: false,
      search_depth: 'advanced',
    }),
  });
  if (!resp.ok) return [];
  const data = await resp.json() as { results?: Array<{ title: string; url: string; content: string }> };
  return (data.results || []).map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.content.substring(0, 500),
  }));
}

async function serperSearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const resp = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ q: query, num: 8 }),
  });
  if (!resp.ok) return [];
  const data = await resp.json() as { organic?: Array<{ title: string; link: string; snippet: string }> };
  return (data.organic || []).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
  }));
}

async function braveSearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, count: '8' });
  const resp = await fetchWithTimeout(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
  });
  if (!resp.ok) return [];
  const data = await resp.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
  return (data.web?.results || []).map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}

export function buildSearchQueries(province: string, nocCode: string): string[] {
  return [
    `${province} Provincial Nominee Program all streams 2026`,
    `${province} PNP immigration streams eligibility requirements`,
    `${province} PNP tech worker stream ${new Date().getFullYear()}`,
    `${province} PNP entrepreneur business immigration stream`,
    `${province} PNP express entry stream requirements`,
    `${province} PNP international graduate stream`,
    `site:canada.ca ${province} provincial nominee program`,
    `NOC ${nocCode} ${province} immigration demand`,
  ];
}

export function buildFederalSearchQueries(): string[] {
  const year = new Date().getFullYear();
  return [
    `Canada Express Entry latest draw scores ${year}`,
    `IRCC Express Entry category-based draws ${year}`,
    `Canada Rural Northern Immigration Pilot ${year}`,
    `Canada immigration new pilot programs ${year}`,
    `IRCC processing times express entry ${year}`,
    `Canada startup visa program updates ${year}`,
    `Canada Atlantic Immigration Program ${year} requirements`,
  ];
}
