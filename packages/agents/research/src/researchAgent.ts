/**
 * researchAgent.ts — PubMed MSK/Physiotherapy Research Monitor
 *
 * Searches PubMed E-utilities API (no API key required) for recent
 * MSK + physiotherapy papers across 5 parallel search terms.
 *
 * Pipeline:
 *   1. esearch.fcgi  → PMIDs (max 5 per term, sorted by date)
 *   2. esummary.fcgi → title, authors, journal, pubdate
 *   3. Deduplicate by PMID, keep top 3 most recent per term
 *   4. Haiku digest  → clinicalInsight, topPaper, weeklyTheme
 *
 * SaMD Class II — research summaries are informational only.
 * No Anthropic SDK dependency — uses native fetch + api/_lib pattern.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PubMedPaper {
  pmid:     string;
  title:    string;
  authors:  string;   // "Smith J, Jones A, et al."
  journal:  string;
  pubdate:  string;
  searchTerm: string;
}

export interface ResearchDigest {
  clinicalInsight: string;   // 2–3 sentences: what this means for PhysioCore
  topPaper: {
    title:     string;
    authors:   string;
    journal:   string;
    pmid:      string;
    relevance: string;
  };
  weeklyTheme: string;       // one phrase summarising the week's research direction
}

export interface ResearchAgentOutput {
  papers:       PubMedPaper[];
  digest:       ResearchDigest;
  fetchedAt:    string;
  processingMs: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const MODEL       = 'claude-haiku-4-5-20251001';
const MAX_TOKENS  = 500;

const SEARCH_TERMS = [
  'physiotherapy AND musculoskeletal AND 2026[pdat]',
  'exercise therapy AND rehabilitation AND 2026[pdat]',
  'posture assessment AND clinical AND 2026[pdat]',
  'chronic pain AND graded exposure AND 2026[pdat]',
  'McKenzie method AND randomized controlled trial',
];

// ── PubMed helpers ────────────────────────────────────────────────────────────

async function esearch(term: string): Promise<string[]> {
  const url = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=5&sort=date&retmode=json`;
  const res  = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { esearchresult?: { idlist?: string[] } };
  return data.esearchresult?.idlist ?? [];
}

interface EsummaryDoc {
  uid:     string;
  title:   string;
  sortfirstauthor: string;
  authors: Array<{ name: string }>;
  fulljournalname: string;
  pubdate: string;
}

async function esummary(pmids: string[]): Promise<EsummaryDoc[]> {
  if (pmids.length === 0) return [];
  const url = `${EUTILS_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
  const res  = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { result?: Record<string, EsummaryDoc> };
  if (!data.result) return [];
  return pmids
    .filter(id => id in data.result!)
    .map(id => data.result![id]);
}

function formatAuthors(doc: EsummaryDoc): string {
  if (!doc.authors?.length) return doc.sortfirstauthor || 'Unknown';
  const names = doc.authors.slice(0, 3).map(a => a.name);
  return doc.authors.length > 3 ? `${names.join(', ')} et al.` : names.join(', ');
}

// ── Paper fetcher (one search term) ──────────────────────────────────────────

async function fetchPapersForTerm(term: string): Promise<PubMedPaper[]> {
  try {
    const pmids = await esearch(term);
    if (pmids.length === 0) return [];

    const docs = await esummary(pmids.slice(0, 5));
    return docs.slice(0, 3).map(doc => ({
      pmid:       doc.uid,
      title:      doc.title || '(no title)',
      authors:    formatAuthors(doc),
      journal:    doc.fulljournalname || 'Unknown Journal',
      pubdate:    doc.pubdate || '',
      searchTerm: term,
    }));
  } catch {
    return [];
  }
}

// ── Haiku digest ──────────────────────────────────────────────────────────────

const DIGEST_SYSTEM = `You are a physiotherapy research analyst summarising recent PubMed papers for a clinical AI platform.
Output ONLY valid JSON — no prose, no markdown:
{
  "clinicalInsight": "2-3 sentences on what this week's findings mean for an AI physiotherapy platform",
  "topPaper": {
    "title": "...",
    "authors": "...",
    "journal": "...",
    "pmid": "...",
    "relevance": "one sentence"
  },
  "weeklyTheme": "one short phrase"
}`;

async function generateDigest(
  papers: PubMedPaper[],
  apiKey: string,
): Promise<ResearchDigest> {
  const paperList = papers.slice(0, 15).map(p =>
    `PMID:${p.pmid} | ${p.title} | ${p.authors} | ${p.journal} (${p.pubdate})`
  ).join('\n');

  const body = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     DIGEST_SYSTEM,
    messages:   [{ role: 'user', content: `Recent MSK/physiotherapy papers:\n${paperList}\n\nGenerate digest JSON.` }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const raw  = data.content.find(b => b.type === 'text')?.text ?? '{}';

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('ResearchAgent: no JSON in Haiku response');
  return JSON.parse(match[0]) as ResearchDigest;
}

// ── Main agent ────────────────────────────────────────────────────────────────

export class ResearchAgent {
  constructor(private readonly apiKey: string) {}

  async run(): Promise<ResearchAgentOutput> {
    const t0 = Date.now();

    // All 5 search terms in parallel
    const perTermResults = await Promise.all(
      SEARCH_TERMS.map(term => fetchPapersForTerm(term))
    );

    // Deduplicate by PMID — first occurrence wins (preserves search-term context)
    const seen   = new Set<string>();
    const papers: PubMedPaper[] = [];
    for (const batch of perTermResults) {
      for (const p of batch) {
        if (!seen.has(p.pmid)) {
          seen.add(p.pmid);
          papers.push(p);
        }
      }
    }

    // Haiku digest — fallback if no papers or API error
    let digest: ResearchDigest;
    try {
      digest = papers.length > 0
        ? await generateDigest(papers, this.apiKey)
        : {
            clinicalInsight: 'No new papers found this week.',
            topPaper: { title: 'N/A', authors: '', journal: '', pmid: '', relevance: '' },
            weeklyTheme: 'No new research this week',
          };
    } catch {
      digest = {
        clinicalInsight: 'Digest generation failed — raw paper list available.',
        topPaper: { title: papers[0]?.title ?? 'N/A', authors: papers[0]?.authors ?? '', journal: papers[0]?.journal ?? '', pmid: papers[0]?.pmid ?? '', relevance: '' },
        weeklyTheme: 'Digest unavailable',
      };
    }

    return {
      papers,
      digest,
      fetchedAt:    new Date().toISOString(),
      processingMs: Date.now() - t0,
    };
  }
}
