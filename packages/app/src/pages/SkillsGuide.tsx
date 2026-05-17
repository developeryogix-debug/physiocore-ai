/**
 * SkillsGuide.tsx
 * Claude Skills Reference — Clinical Noir theme.
 * Public route: /skills (no auth required).
 * Zero external deps — pure inline styles + CSS vars from index.css.
 */
import { useState, useMemo } from 'react';

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Skill {
  name:        string;
  category:    string;
  icon:        string;
  description: string;
  triggers:    string[];
  usage:       string;
  example:     string;
  accent:      string;  // CSS colour for border / badge
}

const SKILLS: Skill[] = [
  {
    name: 'docx', category: 'Document Creation', icon: '📄',
    accent: '#4DB8FF',
    description: 'Create, read, edit, and manipulate Word documents',
    triggers: ['Word doc', '.docx', 'professional document', 'tables of contents', 'letterhead'],
    usage: 'Perfect for generating polished reports, letters, memos with complex formatting, tables, headers/footers, and page numbering.',
    example: 'Creating a formatted business proposal with tracked changes',
  },
  {
    name: 'pdf', category: 'Document Creation', icon: '📕',
    accent: '#FF6B6B',
    description: 'Handle PDF files — read, create, merge, split, fill forms, encrypt',
    triggers: ['.pdf file', 'PDF extraction', 'merge PDFs', 'PDF forms', 'watermark'],
    usage: 'Use for extracting text/tables from PDFs, combining multiple documents, filling forms, or applying security features.',
    example: 'Extracting tables from a 50-page financial report',
  },
  {
    name: 'pptx', category: 'Document Creation', icon: '🎯',
    accent: '#FFB830',
    description: 'Create, edit, and manage PowerPoint presentations',
    triggers: ['deck', 'slides', 'presentation', '.pptx', 'pitch deck'],
    usage: 'Essential for creating slide decks, extracting presentation content, modifying layouts, adding speaker notes.',
    example: 'Building a 30-slide product pitch with custom animations',
  },
  {
    name: 'xlsx', category: 'Data & Spreadsheets', icon: '📊',
    accent: '#00E676',
    description: 'Create and manage spreadsheets — Excel, CSV, data cleaning',
    triggers: ['.xlsx', 'spreadsheet', 'CSV', 'data cleaning', 'formulas', 'charts'],
    usage: 'Ideal for building financial models, cleaning messy data, creating pivot tables, and generating reports.',
    example: 'Cleaning and restructuring a malformed 10,000-row dataset',
  },
  {
    name: 'product-self-knowledge', category: 'AI / Claude Expertise', icon: '🤖',
    accent: '#a78bfa',
    description: 'Accurate facts about Anthropic products: Claude API, Claude Code, Claude.ai',
    triggers: ['Claude pricing', 'API limits', 'Claude features', 'Pro vs Team', 'model specifications'],
    usage: 'Always consult when discussing Claude capabilities, pricing, platform features, or API specifics.',
    example: 'Explaining Claude Pro features vs Team plan pricing',
  },
  {
    name: 'frontend-design', category: 'Web Development', icon: '🎨',
    accent: '#00D4AA',
    description: 'Create production-grade web UIs — React, HTML, landing pages, dashboards',
    triggers: ['website', 'web component', 'landing page', 'dashboard', 'UI design', 'beautiful interface'],
    usage: 'Use for building distinctive, visually striking web applications with modern design principles.',
    example: 'Designing a luxury SaaS dashboard with custom animations',
  },
  {
    name: 'web-artifacts-builder', category: 'Web Development', icon: '🏗️',
    accent: '#7C3AED',
    description: 'Build complex multi-component web artifacts with state management',
    triggers: ['complex web app', 'multi-page artifact', 'routing', 'state management'],
    usage: 'Use for elaborate artifacts requiring React routing, complex state, or many components.',
    example: 'Building a full-featured task management application',
  },
  {
    name: 'file-reading', category: 'File Handling', icon: '📂',
    accent: '#FFB830',
    description: 'Router for reading different file types correctly',
    triggers: ['/mnt/user-data/uploads/', 'uploaded file', 'file path', 'read file from disk'],
    usage: 'Consult first when handling uploaded files to determine the best reading strategy.',
    example: 'Routing to correct handler for a .zip archive vs PDF',
  },
  {
    name: 'pdf-reading', category: 'File Handling', icon: '📖',
    accent: '#FF6B6B',
    description: 'Extract content from PDFs — text, images, tables, forms, OCR',
    triggers: ['PDF content extraction', 'read PDF', 'scanned document', 'table extraction', 'OCR'],
    usage: 'Use when you need to inspect PDF content, extract specific data, or handle scanned documents.',
    example: 'Extracting tables and images from a 200-page research paper',
  },
  {
    name: 'dev-kapil-profile', category: 'Professional Context', icon: '👤',
    accent: '#00D4AA',
    description: 'Comprehensive info on Dev Kapil — skills, achievements, certifications',
    triggers: ['Dev Kapil', 'my background', 'my experience', 'my certifications'],
    usage: "Reference for understanding Dev's complete professional profile, expertise, and achievements.",
    example: 'Tailoring a job application to highlight relevant AI/ML expertise',
  },
  {
    name: 'doc-coauthoring', category: 'Writing & Documentation', icon: '✍️',
    accent: '#FFB830',
    description: 'Structured workflow for co-authoring documentation, proposals, specs',
    triggers: ['write documentation', 'create proposal', 'technical spec', 'decision document'],
    usage: 'Follow this workflow when creating formal documentation to ensure comprehensive, iterative refinement.',
    example: 'Co-authoring a detailed technical specification document',
  },
  {
    name: 'internal-comms', category: 'Writing & Documentation', icon: '📢',
    accent: '#00E676',
    description: 'Write internal communications — status reports, newsletters, FAQs',
    triggers: ['status report', 'leadership update', 'company newsletter', 'incident report'],
    usage: 'Use for crafting professional internal documentation following company communication patterns.',
    example: 'Writing a weekly status report for leadership',
  },
  {
    name: 'canvas-design', category: 'Visual Design', icon: '🖼️',
    accent: '#FFB830',
    description: 'Create visual art — posters, illustrations, graphic designs',
    triggers: ['create poster', 'design art', 'visual design', 'graphic'],
    usage: 'Use when you need original visual artwork, avoiding copyright violations with unique designs.',
    example: 'Designing a conference poster with custom illustrations',
  },
  {
    name: 'theme-factory', category: 'Visual Design', icon: '🎭',
    accent: '#E879F9',
    description: 'Apply themes and styling to artifacts — 10 presets + custom themes',
    triggers: ['theme artifact', 'apply styling', 'color scheme', 'branded design'],
    usage: 'Use to style slides, documents, reports, or web pages with cohesive themes.',
    example: 'Applying a corporate theme across a presentation deck',
  },
  {
    name: 'slack-gif-creator', category: 'Visual Design', icon: '🎬',
    accent: '#FF6B6B',
    description: 'Create animated GIFs optimised for Slack',
    triggers: ['Slack GIF', 'animated GIF', 'animation for Slack'],
    usage: 'Use when you need engaging animated GIFs specifically formatted for Slack sharing.',
    example: 'Creating a celebratory GIF for a team Slack channel',
  },
  {
    name: 'algorithmic-art', category: 'Visual Design', icon: '✨',
    accent: '#00D4AA',
    description: 'Create generative art using p5.js with seeded randomness',
    triggers: ['generative art', 'algorithmic art', 'flow fields', 'particle systems'],
    usage: 'Use for creating unique algorithmic visualisations and interactive art.',
    example: 'Generating a mesmerising flow field visualisation',
  },
  {
    name: 'brand-guidelines', category: 'Visual Design', icon: '🏢',
    accent: '#7C3AED',
    description: "Apply Anthropic's official brand colours, typography, and design standards",
    triggers: ['Anthropic brand', 'brand colors', 'brand guidelines', 'company style'],
    usage: "Reference when creating materials that align with Anthropic's visual identity.",
    example: 'Styling a document with official Anthropic brand colours',
  },
  {
    name: 'skill-creator', category: 'Advanced Development', icon: '⚙️',
    accent: '#4DB8FF',
    description: 'Create, modify, optimise, and benchmark Claude skills',
    triggers: ['create skill', 'modify skill', 'optimise skill', 'skill performance'],
    usage: 'Use when building new capabilities, improving triggering accuracy, or measuring skill effectiveness.',
    example: 'Creating a new skill for specialised domain knowledge',
  },
  {
    name: 'mcp-builder', category: 'Advanced Development', icon: '🔗',
    accent: '#00D4AA',
    description: 'Create MCP (Model Context Protocol) servers for external integrations',
    triggers: ['MCP server', 'integrate external API', 'model context protocol'],
    usage: 'Reference when building tools that enable Claude to interact with external services.',
    example: 'Creating an MCP server to integrate with a custom internal API',
  },
];

const CATEGORY_ORDER = [
  'All',
  'Document Creation',
  'Data & Spreadsheets',
  'Web Development',
  'File Handling',
  'Writing & Documentation',
  'Visual Design',
  'AI / Claude Expertise',
  'Professional Context',
  'Advanced Development',
];

const COMBINATIONS = [
  { goal: 'Create branded presentation', skills: 'pptx + theme-factory + brand-guidelines' },
  { goal: 'Extract & reformat data',     skills: 'pdf-reading → docx for reporting' },
  { goal: 'Build complete web app',      skills: 'frontend-design + web-artifacts-builder' },
  { goal: 'Document a project',          skills: 'doc-coauthoring + docx + canvas-design' },
  { goal: 'Extract PDF insights',        skills: 'pdf-reading + doc-coauthoring + docx' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${open ? skill.accent + '55' : 'var(--border-subtle)'}`,
        borderRadius: '14px',
        padding: '1.25rem 1.4rem',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: open ? `0 0 0 1px ${skill.accent}22, 0 8px 32px ${skill.accent}14` : 'none',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
            background: `${skill.accent}18`,
            border: `1px solid ${skill.accent}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.35rem',
          }}>
            {skill.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <h3 style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.85rem', fontWeight: 600,
                color: 'var(--text-primary)', margin: 0,
              }}>{skill.name}</h3>
              <span style={{
                padding: '1px 7px', borderRadius: '20px',
                background: `${skill.accent}18`, border: `1px solid ${skill.accent}33`,
                color: skill.accent, fontSize: '0.6rem',
                fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
              }}>
                {skill.category}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0, lineHeight: 1.45 }}>
              {skill.description}
            </p>
          </div>
        </div>
        <div style={{ color: open ? skill.accent : 'var(--text-tertiary)', flexShrink: 0, marginTop: '2px', transition: 'color 0.2s' }}>
          <ChevronIcon open={open} />
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={{
          marginTop: '1rem', paddingTop: '1rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'grid', gap: '0.85rem',
        }}>
          {/* Usage */}
          <div>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.62rem', color: skill.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>
              ⚡ When to Use
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.55, margin: 0 }}>
              {skill.usage}
            </p>
          </div>

          {/* Triggers */}
          <div>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.62rem', color: '#00E676', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              🎯 Triggers
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {skill.triggers.map(t => (
                <span key={t} style={{
                  padding: '3px 9px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', fontSize: '0.72rem',
                  fontFamily: "'Space Mono', monospace",
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Example */}
          <div style={{
            padding: '8px 12px', borderRadius: '8px',
            background: `${skill.accent}0d`, border: `1px solid ${skill.accent}22`,
          }}>
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.62rem', color: skill.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>
              💡 Example
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>
              {skill.example}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillsGuide() {
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState('All');

  const categories = CATEGORY_ORDER.filter(c =>
    c === 'All' || SKILLS.some(s => s.category === c)
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return SKILLS.filter(s => {
      const matchCat  = category === 'All' || s.category === category;
      const matchText = !q
        || s.name.toLowerCase().includes(q)
        || s.description.toLowerCase().includes(q)
        || s.category.toLowerCase().includes(q)
        || s.triggers.some(t => t.toLowerCase().includes(q));
      return matchCat && matchText;
    });
  }, [query, category]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: '100px', paddingBottom: '5rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          {/* Glow icon */}
          <div style={{
            width: 68, height: 68, borderRadius: '18px', margin: '0 auto 1.5rem',
            background: 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(77,184,255,0.1))',
            border: '1px solid var(--border-teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem',
            boxShadow: '0 0 40px rgba(0,212,170,0.1)',
          }}>
            ⚡
          </div>

          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 'clamp(2rem, 5vw, 2.75rem)',
            fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem',
          }}>
            Claude <span style={{ color: 'var(--teal-500)' }}>Skills</span> Guide
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, maxWidth: 540, margin: '0 auto 0.5rem' }}>
            19 specialised skills — know when to trigger each one.
          </p>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
            {[['19', 'Total Skills'], ['7', 'Categories'], ['May 2026', 'Updated']].map(([val, label]) => (
              <div key={label} style={{
                padding: '5px 14px', borderRadius: '20px',
                background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)',
                display: 'flex', gap: '6px', alignItems: 'center',
              }}>
                <span style={{ color: 'var(--teal-500)', fontFamily: "'Space Mono',monospace", fontSize: '0.78rem', fontWeight: 700 }}>{val}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto 1.5rem' }}>
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search by name, trigger, or category…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.7rem 1rem 0.7rem 2.5rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal-500)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          />
        </div>

        {/* ── Category filter ── */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2rem' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '5px 14px', borderRadius: '20px', border: 'none',
                cursor: 'pointer', fontSize: '0.78rem',
                fontFamily: "'Space Mono', monospace",
                transition: 'all 0.15s',
                background: category === cat ? 'var(--teal-500)' : 'var(--bg-surface)',
                color: category === cat ? '#050810' : 'var(--text-tertiary)',
                outline: 'none',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Results count ── */}
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: "'Space Mono',monospace", textAlign: 'center', marginBottom: '1.25rem' }}>
          {filtered.length} skill{filtered.length !== 1 ? 's' : ''} shown
        </p>

        {/* ── Skills grid ── */}
        {filtered.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '12px', marginBottom: '3rem' }}>
            {filtered.map(s => <SkillCard key={s.name} skill={s} />)}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '1rem' }}>No skills match your search.</p>
          </div>
        )}

        {/* ── Combinations table ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
            🔗 Common Skill Combinations
          </h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {COMBINATIONS.map(c => (
              <div key={c.goal} style={{
                display: 'flex', gap: '14px', alignItems: 'center',
                padding: '8px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', minWidth: 220 }}>{c.goal}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', color: 'var(--teal-500)' }}>{c.skills}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Expert tips ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.5rem',
        }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--teal-500)' }}><ZapIcon /></span> Expert Tips
          </h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {[
              { color: '#4DB8FF', label: 'Match triggers', tip: 'Each skill has specific trigger phrases — if your request matches these, the skill activates automatically.' },
              { color: '#00E676', label: 'Combine skills', tip: 'Many tasks benefit from chaining skills, e.g. pdf-reading + docx to extract then reformat.' },
              { color: '#a78bfa', label: 'Be explicit', tip: "Mention a skill by name to guarantee activation: \"Use the frontend-design skill to…\"" },
              { color: '#FFB830', label: 'Check references', tip: 'Consult product-self-knowledge, dev-kapil-profile, and brand-guidelines before content that references them.' },
              { color: '#FF6B6B', label: 'Chain workflows', tip: 'doc-coauthoring → structure → docx → output → theme-factory → brand.' },
            ].map(({ color, label, tip }) => (
              <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', color, fontWeight: 700, minWidth: 120, paddingTop: '1px' }}>→ {label}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
