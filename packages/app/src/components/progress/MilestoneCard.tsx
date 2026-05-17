/**
 * MilestoneCard.tsx — Locked/unlocked milestone badge grid.
 * 6 milestone types. Teal glow on unlock. No external services.
 * Clinical Noir design system. Font weight max 600.
 */

interface Milestone {
  type: string;
  label: string;
  desc: string;
  unlocked: boolean;
  unlockedAt: string | null;
  isNew?: boolean;
}

const MILESTONE_ICONS: Record<string, string> = {
  first_session:   '▶',
  streak_7:        '◎',
  posture_improve: '⬡',
  pain_reduce:     '◉',
  rom_10pct:       '✦',
  swarm_assess:    '⬢',
};

interface MilestoneCardProps {
  milestones: Milestone[];
}

export function MilestoneCard({ milestones }: MilestoneCardProps) {
  const unlockedCount = milestones.filter(m => m.unlocked).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          fontFamily: "'Space Mono', monospace",
        }}>
          Milestones
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace" }}>
          {unlockedCount}/{milestones.length}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${(unlockedCount / milestones.length) * 100}%`,
          background: 'linear-gradient(90deg, var(--teal-500), var(--blue-400))',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>

      {/* Badge grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {milestones.map(m => (
          <div
            key={m.type}
            title={m.unlocked ? `${m.desc}${m.unlockedAt ? ` · ${new Date(m.unlockedAt).toLocaleDateString()}` : ''}` : `Locked: ${m.desc}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 5, padding: '10px 6px', borderRadius: 10, textAlign: 'center',
              background: m.unlocked ? 'rgba(0,212,170,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${m.unlocked ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: m.isNew ? '0 0 14px rgba(0,212,170,0.25)' : 'none',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            {/* "NEW" ribbon */}
            {m.isNew && (
              <div style={{
                position: 'absolute', top: -6, right: -6,
                background: 'var(--teal-500)', color: '#000',
                fontSize: '0.5rem', fontWeight: 600, padding: '1px 5px',
                borderRadius: 99, fontFamily: "'Space Mono', monospace",
                letterSpacing: '0.06em',
              }}>
                NEW
              </div>
            )}

            {/* Icon circle */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: m.unlocked ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)',
              fontSize: '0.9rem',
              color: m.unlocked ? 'var(--teal-500)' : 'var(--text-tertiary)',
              filter: m.unlocked ? 'none' : 'grayscale(1) opacity(0.4)',
            }}>
              {MILESTONE_ICONS[m.type] ?? '◎'}
            </div>

            {/* Label */}
            <div style={{
              fontSize: '0.65rem', fontWeight: 600, lineHeight: 1.3,
              color: m.unlocked ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontFamily: "'Space Mono', monospace",
            }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
