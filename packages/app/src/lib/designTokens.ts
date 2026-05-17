/**
 * designTokens.ts — Clinical Noir design system constants
 * Source of truth for motion curves, elevation shadows, and colour roles.
 * Import in components; never hardcode raw values in JSX.
 */

// ── Motion ────────────────────────────────────────────────────────────────────

export const MOTION = {
  instant:  '0ms',
  micro:    '100ms ease',
  standard: '220ms cubic-bezier(0.4, 0, 0.2, 1)',
  entrance: '300ms cubic-bezier(0.0, 0, 0.2, 1)',
  exit:     '200ms cubic-bezier(0.4, 0, 1, 1)',
  spring:   '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export type MotionKey = keyof typeof MOTION;

// ── Elevation shadows (no borders — shadow only) ──────────────────────────────

export const ELEVATION = {
  0: '0 0 0 rgba(0,0,0,0)',
  1: '0 1px 4px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.04)',
  2: '0 4px 16px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.05)',
  3: '0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06)',
  4: '0 16px 48px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.08)',
  teal: '0 4px 24px rgba(0,212,170,0.12), 0 0 0 1px rgba(0,212,170,0.16)',
} as const;

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

// ── Colour roles ──────────────────────────────────────────────────────────────
// Sole teal accent: #00D4AA. No purple. No orange gradients.

export const COLOR_ROLES = {
  surface: {
    void:     '#050810',
    base:     '#080D14',
    default:  '#0D1420',
    elevated: '#121B2E',
    overlay:  '#192337',
  },
  accent: {
    teal:    '#00D4AA',
    tealLo:  '#00A882',
    tealDim: 'rgba(0,212,170,0.08)',
    tealGlow:'rgba(0,212,170,0.15)',
    blue:    '#4DB8FF',
    blueDim: 'rgba(77,184,255,0.08)',
  },
  semantic: {
    success: '#00E676',
    warning: '#FFB830',
    danger:  '#FF4444',
    info:    '#4DB8FF',
  },
  text: {
    primary:   '#F0F4FF',
    secondary: '#8892A4',
    tertiary:  '#4A5568',
    teal:      '#00D4AA',
  },
  border: {
    subtle:  'rgba(255,255,255,0.04)',
    default: 'rgba(255,255,255,0.08)',
    strong:  'rgba(255,255,255,0.16)',
    teal:    'rgba(0,212,170,0.20)',
  },
} as const;
