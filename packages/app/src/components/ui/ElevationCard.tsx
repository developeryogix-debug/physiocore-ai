/**
 * ElevationCard.tsx — Shadow-based card, no borders.
 * 4 elevation levels. Teal hover glow. borderRadius 12px.
 * Clinical Noir design system. Font weight max 600.
 */
import { useState, type ReactNode } from 'react';
import { ELEVATION, type ElevationLevel } from '../../lib/designTokens.js';

const BG: Record<ElevationLevel, string> = {
  0: 'var(--bg-void)',
  1: 'var(--bg-surface)',
  2: 'var(--bg-elevated)',
  3: 'var(--bg-overlay)',
  4: 'var(--bg-overlay)',
};

interface ElevationCardProps {
  children:  ReactNode;
  level?:    ElevationLevel;
  hover?:    boolean;
  padding?:  string | number;
  style?:    React.CSSProperties;
  className?: string;
  onClick?:  () => void;
  as?:       'div' | 'article' | 'section';
}

export function ElevationCard({
  children,
  level     = 1,
  hover     = true,
  padding   = '1.5rem',
  style,
  className,
  onClick,
  as: Tag   = 'div',
}: ElevationCardProps) {
  const [hovered, setHovered] = useState(false);

  const shadow = hovered && hover ? ELEVATION.teal : ELEVATION[level];

  return (
    <Tag
      className={className}
      onClick={onClick}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() =>          setHovered(false)}
      style={{
        background:    BG[level],
        borderRadius:  12,
        padding,
        boxShadow:     shadow,
        transition:    'box-shadow 220ms cubic-bezier(0.4,0,0.2,1)',
        cursor:        onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
