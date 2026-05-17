/**
 * StreakCalendar.tsx — 28-day session activity grid + current streak count.
 * Reads raw date strings; teal = session day, dark = rest day.
 * Clinical Noir design system. No emoji. Font weight max 600.
 */

interface StreakCalendarProps {
  sessionDates: string[];   // ISO date strings (YYYY-MM-DD or full ISO)
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StreakCalendar({ sessionDates }: StreakCalendarProps) {
  const dateSet = new Set(sessionDates.map(d => d.slice(0, 10)));

  // Build 28-day grid (4 weeks, oldest first)
  const today = new Date();
  const days: Array<{ iso: string; dow: number; isToday: boolean }> = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ iso: d.toISOString().slice(0, 10), dow: d.getDay(), isToday: i === 0 });
  }

  // Current streak (count consecutive days with session going back from today)
  let currentStreak = 0;
  for (let i = 0; i <= 27; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (dateSet.has(d.toISOString().slice(0, 10))) currentStreak++;
    else break;
  }

  // Longest streak in period
  let longest = 0; let run = 0;
  for (const day of days) {
    if (dateSet.has(day.iso)) { run++; longest = Math.max(longest, run); }
    else run = 0;
  }

  // Sessions in last 7 days
  const last7 = days.slice(-7).filter(d => dateSet.has(d.iso)).length;

  return (
    <div>
      {/* Header */}
      <div style={{
        fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        fontFamily: "'Space Mono', monospace", marginBottom: 12,
      }}>
        28-Day Activity
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {DAY_LABELS.map(l => (
          <div key={l} style={{
            fontSize: '0.6rem', color: 'var(--text-tertiary)',
            textAlign: 'center', fontFamily: "'Space Mono', monospace",
          }}>
            {l[0]}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 14 }}>
        {days.map(day => {
          const active = dateSet.has(day.iso);
          return (
            <div
              key={day.iso}
              title={`${day.iso}${active ? ' · session' : ''}`}
              style={{
                aspectRatio: '1',
                borderRadius: 4,
                background: active
                  ? 'var(--teal-500)'
                  : day.isToday
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.03)',
                border: day.isToday && !active
                  ? '1px solid rgba(0,212,170,0.35)'
                  : '1px solid transparent',
                boxShadow: active ? '0 0 6px rgba(0,212,170,0.3)' : 'none',
                transition: 'background 0.15s',
              }}
            />
          );
        })}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { label: 'Current Streak', value: `${currentStreak}d` },
          { label: 'Best (28d)',      value: `${longest}d`       },
          { label: 'This Week',      value: `${last7}/7`         },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px', textAlign: 'center',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace" }}>
              {value}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 2, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
