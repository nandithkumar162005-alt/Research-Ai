import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { SYSTEM_PROMPT } from "./prompts";
import type { ResearchResult, ResearchPaper } from "../types";

// ─────────────────────────────────────────────────────────────
// SOURCE FETCHERS  (each returns raw results independently)
// ─────────────────────────────────────────────────────────────

async function fetchCrossref(query: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&select=DOI,title,author,published,abstract,URL,is-referenced-by-count&rows=8&sort=relevance`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.message?.items || []).map((item: any) => ({
      source: "Crossref",
      source_id: item.DOI || item.URL,
      title: item.title?.[0] || "Unknown Title",
      authors: item.author?.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()) || [],
      year: item.published?.["date-parts"]?.[0]?.[0] || null,
      doi: item.DOI,
      url: item.URL,
      abstract: item.abstract?.replace(/<[^>]*>?/gm, "") || "",
      citations: item["is-referenced-by-count"] || 0,
    }));
  } catch { return []; }
}

async function fetchOpenAlex(query: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=8&select=id,doi,title,authorships,publication_year,abstract_inverted_index,primary_location,cited_by_count,open_access`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: any) => {
      let abstract = "";
      if (item.abstract_inverted_index) {
        const wordPos: Array<[string, number]> = [];
        for (const [word, positions] of Object.entries(item.abstract_inverted_index as Record<string, number[]>)) {
          for (const pos of positions) wordPos.push([word, pos]);
        }
        abstract = wordPos.sort((a, b) => a[1] - b[1]).map(([w]) => w).join(" ");
      }
      return {
        source: "OpenAlex",
        source_id: item.id,
        title: item.title || "Unknown Title",
        authors: (item.authorships || []).map((a: any) => a.author?.display_name || "").filter(Boolean),
        year: item.publication_year,
        doi: item.doi,
        url: item.primary_location?.source?.homepage_url || item.open_access?.oa_url,
        abstract,
        citations: item.cited_by_count || 0,
      };
    });
  } catch { return []; }
}

async function fetchSemanticScholar(query: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=8&fields=title,authors,year,abstract,externalIds,url,citationCount,openAccessPdf`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((item: any) => ({
      source: "Semantic Scholar",
      source_id: item.paperId,
      title: item.title || "Unknown Title",
      authors: (item.authors || []).map((a: any) => a.name || ""),
      year: item.year,
      doi: item.externalIds?.DOI,
      url: item.openAccessPdf?.url || item.url,
      abstract: item.abstract || "",
      citations: item.citationCount || 0,
    }));
  } catch { return []; }
}

async function fetchArxiv(query: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=6&sortBy=relevance`
    );
    if (!res.ok) return [];
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");
    const entries = Array.from(xml.querySelectorAll("entry"));
    return entries.map((entry) => {
      const authors = Array.from(entry.querySelectorAll("author name")).map((n) => n.textContent || "");
      const yearStr = entry.querySelector("published")?.textContent?.slice(0, 4);
      return {
        source: "arXiv",
        source_id: entry.querySelector("id")?.textContent,
        title: entry.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim() || "Unknown",
        authors,
        year: yearStr ? parseInt(yearStr) : null,
        doi: null,
        url: entry.querySelector("id")?.textContent,
        abstract: entry.querySelector("summary")?.textContent?.replace(/\s+/g, " ").trim() || "",
        citations: 0,
      };
    });
  } catch { return []; }
}

async function fetchExa(query: string, exaKey: string): Promise<any[]> {
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": exaKey },
      body: JSON.stringify({ query, numResults: 8, useAutoprompt: true, type: "neural", contents: { text: { maxCharacters: 800 } } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: any) => ({
      source: "Exa",
      source_id: item.id,
      title: item.title || "Untitled",
      authors: [],
      year: item.publishedDate ? parseInt(item.publishedDate.slice(0, 4)) : null,
      doi: null,
      url: item.url,
      abstract: item.text || "",
      citations: 0,
    }));
  } catch { return []; }
}

async function fetchTavily(query: string, tavilyKey: string): Promise<any[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: tavilyKey, query, search_depth: "advanced", max_results: 6, include_raw_content: true }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: any) => ({
      source: "Tavily",
      source_id: item.url,
      title: item.title || "Untitled",
      authors: [],
      year: null,
      doi: null,
      url: item.url,
      abstract: item.content || item.raw_content || "",
      citations: 0,
    }));
  } catch { return []; }
}

async function fetchCustom(query: string, endpoint: string, name: string, apiKey: string): Promise<any[]> {
  try {
    const url = endpoint.includes('{query}') ? endpoint.replace('{query}', encodeURIComponent(query)) : `${endpoint}${encodeURIComponent(query)}`;
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["X-API-Key"] = apiKey;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    
    // Generic parser for standard structures (results, items, data)
    const items = data.results || data.items || data.data || data.web?.results || (Array.isArray(data) ? data : []);
    return items.slice(0, 6).map((item: any) => ({
      source: name,
      source_id: item.url || item.id || item.link || Math.random().toString(),
      title: item.title || item.name || "Untitled",
      authors: [],
      year: null,
      doi: null,
      url: item.url || item.link,
      abstract: item.content || item.snippet || item.description || item.body || "",
      citations: 0,
    }));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────
// DEDUPLICATION
// ─────────────────────────────────────────────────────────────

function deduplicateSources(sources: any[]): any[] {
  const seen = new Map<string, any>();
  for (const s of sources) {
    const key = s.doi
      ? `doi:${s.doi.toLowerCase()}`
      : `title:${s.title.toLowerCase().slice(0, 60)}`;
    if (!seen.has(key)) {
      seen.set(key, s);
    } else {
      const existing = seen.get(key);
      if ((s.abstract?.length || 0) > (existing.abstract?.length || 0)) {
        seen.set(key, { ...s, source: `${existing.source} + ${s.source}` });
      } else {
        seen.set(key, { ...existing, source: `${existing.source} + ${s.source}` });
      }
    }
  }
  return Array.from(seen.values());
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface SourceStatus {
  name: string;
  status: "pending" | "done" | "error" | "skipped";
  resultCount: number;
}

export type OnProgressCallback = (steps: SourceStatus[], agentStep: string) => void;

// Verified working Gemini models (v1beta)
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

// Fetch available Groq models dynamically to avoid decommissioned IDs
async function getGroqModels(apiKey: string): Promise<string[]> {
  // Best chat models in priority order — will be filtered to only available ones
  const PREFERRED = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
  ];
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return PREFERRED;
    const data = await res.json();
    const available = new Set<string>((data.data || []).map((m: any) => m.id as string));
    // Return preferred models that are actually available
    const ordered = PREFERRED.filter(id => available.has(id));
    if (ordered.length > 0) return ordered;
    // Fallback: pick any available model that looks like a chat model
    const chatKeywords = ["llama", "gemma", "qwen", "gpt-oss", "mistral", "deepseek"];
    const nonChat = ["whisper", "tts", "guard", "safeguard", "embed", "arabic-saudi", "orpheus"];
    return [...available].filter(id => {
      const low = id.toLowerCase();
      return chatKeywords.some(k => low.includes(k)) && !nonChat.some(k => low.includes(k));
    }).slice(0, 4);
  } catch {
    return PREFERRED;
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN AGENT FUNCTION
// ─────────────────────────────────────────────────────────────

export const performResearch = async (
  query: string,
  keys: Record<string, string>,
  onProgress?: OnProgressCallback
): Promise<ResearchResult> => {
  // Trim keys — prevents copy-paste whitespace failures
  const k: Record<string, string> = {};
  for (const [name, val] of Object.entries(keys)) k[name] = (val || "").trim();

  if (!k.gemini && !k.groq) {
    throw new Error("No AI key found. Add a Gemini or Groq API key in API Settings.");
  }

  // Read custom sources from localStorage
  const savedCustom = localStorage.getItem('research_radar_custom_sources');
  const customSources = savedCustom ? JSON.parse(savedCustom) : [];

  const statuses: SourceStatus[] = [
    { name: "Crossref",          status: "pending",                        resultCount: 0 },
    { name: "OpenAlex",          status: "pending",                        resultCount: 0 },
    { name: "Semantic Scholar",  status: "pending",                        resultCount: 0 },
    { name: "arXiv",             status: "pending",                        resultCount: 0 },
    { name: "Exa",               status: k.exa    ? "pending" : "skipped", resultCount: 0 },
    { name: "Tavily",            status: k.tavily ? "pending" : "skipped", resultCount: 0 },
    ...customSources.map((s: any) => ({ name: s.name, status: k[s.id] || !s.endpoint.includes('api_key') ? "pending" : "skipped", resultCount: 0 }))
  ];

  const tick = (name: string, st: SourceStatus["status"], n: number) => {
    const i = statuses.findIndex(s => s.name === name);
    if (i !== -1) { statuses[i] = { ...statuses[i], status: st, resultCount: n }; }
    onProgress?.([...statuses], "Gathering evidence...");
  };

  const safe = async (name: string, fn: () => Promise<any[]>) => {
    try { const r = await fn(); tick(name, "done", r.length); return r; }
    catch { tick(name, "error", 0); return []; }
  };

  const promises = [
    safe("Crossref",         () => fetchCrossref(query)),
    safe("OpenAlex",         () => fetchOpenAlex(query)),
    safe("Semantic Scholar", () => fetchSemanticScholar(query)),
    safe("arXiv",            () => fetchArxiv(query)),
    k.exa    ? safe("Exa",    () => fetchExa(query, k.exa))       : Promise.resolve([]),
    k.tavily ? safe("Tavily", () => fetchTavily(query, k.tavily)) : Promise.resolve([]),
    ...customSources.map((s: any) => 
      (k[s.id] || s.endpoint) ? safe(s.name, () => fetchCustom(query, s.endpoint, s.name, k[s.id] || '')) : Promise.resolve([])
    )
  ];

  const results = await Promise.allSettled(promises);

  const allRaw = results.reduce((acc: any[], res) => {
    if (res.status === "fulfilled") return [...acc, ...res.value];
    return acc;
  }, []);

  const papers: ResearchPaper[] = deduplicateSources(allRaw).map((s, idx) => ({
    id:             s.source_id || `paper-${idx}`,
    title:          s.title,
    authors:        s.authors,
    year:           s.year || new Date().getFullYear(),
    source:         s.source,
    doi:            s.doi,
    abstract:       s.abstract,
    relevance:      "",
    citationNumber: idx + 1,
    url:            s.url,
  }));

  onProgress?.([...statuses], "Synthesizing with AI...");

  // ── Build prompt (keep compact to fit model context windows) ──
  // Cap at 12 papers and 200 chars per abstract to stay well within limits
  const topPapers = papers.slice(0, 12);
  const prompt = [
    `Research Question: "${query}"`,
    "",
    `Retrieved sources (${topPapers.length} of ${papers.length} shown):`,
    JSON.stringify(topPapers.map(p => ({
      source_id:       p.id,
      source_provider: p.source,
      title:           p.title,
      authors:         p.authors.slice(0, 2),
      year:            p.year,
      doi:             p.doi || null,
      abstract:        (p.abstract || "").slice(0, 200),
    })), null, 2),
    "",
    "Return ONLY valid JSON. No markdown, no prose.",
  ].join("\n");

  let responseText = "";
  let lastErr: Error | null = null;

  // ── Try Gemini ───────────────────────────────────────────────
  if (k.gemini) {
    const genAI = new GoogleGenerativeAI(k.gemini);
    for (const modelName of GEMINI_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        });
        const res  = await model.generateContent(prompt);
        const text = res.response.text();
        if (text?.trim()) {
          responseText = text.replace(/```json|```/g, "").trim();
          lastErr = null;
          break;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`[ResearchRadar] Gemini ${modelName}:`, err?.message);
      }
    }
  }

  // ── Fall back to Groq ────────────────────────────────────────
  if (!responseText && k.groq) {
    console.info("[ResearchRadar] Falling back to Groq...");
    const groq = new Groq({ apiKey: k.groq, dangerouslyAllowBrowser: true });
    const groqModels = await getGroqModels(k.groq);
    for (const model of groqModels) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            // Use a condensed system instruction that includes the required JSON schema
            { 
              role: "system", 
              content: `You are a research synthesis AI. Return ONLY a valid JSON object matching this schema exactly:
{
  "summary": "Detailed textual synthesis of the evidence (2-3 paragraphs)",
  "supporting_evidence": [{"source_id": "id", "evidence": "quote"}],
  "conflicting_evidence": [{"source_id": "id", "evidence": "quote"}],
  "knowledge_gaps": [{"gap": "description", "why_it_matters": "reason"}],
  "research_connections": [{"connection": "topic", "evidence_source_ids": ["id"]}]
}` 
            },
            { role: "user",   content: prompt },
          ],
          temperature: 0.2,
          // Do NOT set max_tokens — let each model use its own limit
        });
        const text = completion.choices[0]?.message?.content;
        if (text?.trim()) {
          responseText = text.replace(/```json|```/g, "").trim();
          lastErr = null;
          break;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`[ResearchRadar] Groq ${model}:`, err?.message);
      }
    }
  }

  // ── All providers failed ─────────────────────────────────────
  if (!responseText) {
    const msg = lastErr?.message || "";
    if (msg.includes("API_KEY") || msg.includes("INVALID_ARGUMENT") || msg.toLowerCase().includes("api key")) {
      throw new Error("Invalid API key. Re-enter it in API Settings and use the Test button.");
    }
    if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate_limit")) {
      throw new Error("Quota exceeded. Wait a moment or add a Groq key as fallback in API Settings.");
    }
    throw new Error(`All AI providers failed. ${msg ? `Last error: ${msg}` : "Check your keys in API Settings."}`);
  }

  // ── Parse JSON ───────────────────────────────────────────────
  let parsed: any = {};
  try {
    parsed = JSON.parse(responseText);
  } catch {
    const m = responseText.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
  }

  // Safely extract arrays even if model used slightly wrong keys
  const getArr = (keys: string[]) => {
    for (const k of keys) {
      if (Array.isArray(parsed[k]) && parsed[k].length > 0) return parsed[k];
    }
    return [];
  };

  const supportRaw = getArr(["supporting_evidence", "supporting", "evidence"]);
  const conflictRaw = getArr(["conflicting_evidence", "conflicting", "contradictions"]);
  const gapsRaw = getArr(["knowledge_gaps", "gaps", "limitations"]);
  const connRaw = getArr(["research_connections", "connections", "related_topics"]);

  // ── Build result ─────────────────────────────────────────────
  return {
    query,
    synthesis: parsed.summary || parsed.synthesis || parsed.overview || "AI synthesis complete.",
    papers,
    evidence: [
      ...supportRaw.map((e: any, i: number) => ({
        id:       `supp-${i}`,
        paperId:  e.source_id || e.id || "",
        type:     "supporting" as const,
        excerpt:  e.evidence || e.quote || e.text || e.title || (typeof e === 'string' ? e : "Evidence provided"),
        strength: "moderate" as const,
      })),
      ...conflictRaw.map((e: any, i: number) => ({
        id:       `conf-${i}`,
        paperId:  e.source_id || e.id || "",
        type:     "conflicting" as const,
        excerpt:  e.evidence || e.quote || e.text || e.title || (typeof e === 'string' ? e : "Evidence provided"),
        strength: "moderate" as const,
      })),
    ],
    gaps: gapsRaw.map((g: any, i: number) => ({
      id:              `gap-${i}`,
      title:           g.gap || g.title || g.description || (typeof g === 'string' ? g : "Knowledge Gap"),
      description:     g.why_it_matters || g.reason || "",
      evidenceCoverage:`Based on ${papers.length} retrieved documents`,
      relatedSources:  g.evidence_source_ids || [],
      whyItMatters:    g.why_it_matters || g.reason || "Requires further research.",
    })),
    contradictions: [],
    landscape: {
      id:            "root",
      label:         "Research Landscape",
      paperCount:    papers.length,
      relatedSources:[],
      children: connRaw.slice(0, 5).map((c: any, i: number) => ({
        id:            `conn-${i}`,
        label:          c.connection || c.topic || c.label || (typeof c === 'string' ? c : "Topic"),
        paperCount:     (c.evidence_source_ids || []).length || 1,
        relatedSources: c.evidence_source_ids || [],
      })),
    },
  };
};
