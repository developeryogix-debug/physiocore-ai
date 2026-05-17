/**
 * EmptyState.tsx — Icon circle + title + description + optional CTA.
 * Clinical Noir design system. No emoji in component itself.
 * Icon prop accepts any ReactNode (SVG, text glyph, etc.).
 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon:         ReactNode;
  title:        string;
  description?: string;
  action?:      { label: string; onClick: () => void };
  style?:       React.CSSProperties;
}

export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  return (
    <div className="pc-empty" style={style}>
      <div className="pc-empty__icon">{icon}</div>

      <div>
        <div className="pc-empty__title">{title}</div>
        {description && (
          <div className="pc-empty__desc">{description}</div>
        )}
      </div>

      {action && (
        <button
          type="button"
          className="btn-primary"
          onClick={action.onClick}
          style={{ fontSize: '0.82rem', padding: '0.6rem 1.5rem' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
