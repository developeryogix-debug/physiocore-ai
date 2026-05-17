/**
 * SlidingTabs.tsx — GPU-accelerated sliding pill tab strip
 * Clinical Noir design system. No emoji. Font weight max 600.
 * Uses requestAnimationFrame for pill position sync.
 */
import { useState, useRef, useLayoutEffect, useCallback } from 'react';

export interface Tab {
  key: string;
  label: string;
}

interface SlidingTabsProps {
  tabs:     Tab[];
  active:   string;
  onChange: (key: string) => void;
  style?:   React.CSSProperties;
}

export function SlidingTabs({ tabs, active, onChange, style }: SlidingTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs     = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rafRef       = useRef<number | null>(null);
  const [pillStyle, setPillStyle] = useState<React.CSSProperties>({ left: 3, width: 0 });

  const syncPill = useCallback(() => {
    const container = containerRef.current;
    const activeEl  = itemRefs.current.get(active);
    if (!container || !activeEl) return;

    const cRect = container.getBoundingClientRect();
    const aRect = activeEl.getBoundingClientRect();

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPillStyle({
        left:  aRect.left - cRect.left,
        width: aRect.width,
      });
      rafRef.current = null;
    });
  }, [active]);

  useLayoutEffect(() => {
    syncPill();
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [syncPill]);

  return (
    <div ref={containerRef} className="pc-tabs" style={style}>
      {/* Sliding pill — GPU layer via will-change */}
      <div
        className="pc-tabs__pill"
        style={{
          ...pillStyle,
          transition: `left var(--motion-standard), width var(--motion-standard)`,
        }}
      />

      {tabs.map((tab) => (
        <button
          key={tab.key}
          ref={(el) => {
            if (el) itemRefs.current.set(tab.key, el);
            else    itemRefs.current.delete(tab.key);
          }}
          type="button"
          className={`pc-tabs__item${active === tab.key ? ' pc-tabs__item--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
