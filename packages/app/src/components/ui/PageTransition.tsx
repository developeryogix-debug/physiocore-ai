/**
 * PageTransition.tsx — Wraps a page in a CSS animation on mount.
 * Directions: right | left | up | none (fade).
 * Keyframes defined in design-system.css.
 * Clinical Noir design system. Vite SPA — no SSR patterns.
 */
import type { ReactNode } from 'react';

export type TransitionDirection = 'right' | 'left' | 'up' | 'none';

const ANIMATION: Record<TransitionDirection, string> = {
  right: 'pc-slide-in-right var(--motion-entrance) both',
  left:  'pc-slide-in-left  var(--motion-entrance) both',
  up:    'pc-slide-up        var(--motion-entrance) both',
  none:  'pc-fade-in         var(--motion-standard) both',
};

interface PageTransitionProps {
  children:   ReactNode;
  direction?: TransitionDirection;
  style?:     React.CSSProperties;
}

export function PageTransition({
  children,
  direction = 'none',
  style,
}: PageTransitionProps) {
  return (
    <div style={{ animation: ANIMATION[direction], ...style }}>
      {children}
    </div>
  );
}
