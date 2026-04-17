// ============================================================
//  ChefWarningBanner — aviso editorial para planes del chef.
//
//  Render estilo margen-editorial (NYT Cooking) en vez de alerta
//  agresiva: borde izquierdo teñido, fondo soft, título serif italic,
//  detalle sans. Encaja con la paleta warm del resto del chef.
//
//  Tonos:
//    info  — informativo (plan fuera del margen, platos repetidos…)
//    warn  — atención (proteína baja, usuario sobrepasado…)
//    error — grave (rara vez usado; reservado para fallos reales)
// ============================================================

import type { ReactNode } from 'react';

export type WarningTone = 'info' | 'warn' | 'error';

const TONE_STYLES: Record<WarningTone, {
  bg: string;
  borderAccent: string;
  borderSoft: string;
  title: string;
}> = {
  info: {
    bg: 'rgba(22,163,74,0.05)',        // accent green tint
    borderAccent: 'rgba(22,163,74,0.35)',
    borderSoft:   'rgba(22,163,74,0.15)',
    title: '#166534',
  },
  warn: {
    bg: 'rgba(245,158,11,0.07)',       // amber tint
    borderAccent: 'rgba(200,148,36,0.40)',
    borderSoft:   'rgba(200,148,36,0.18)',
    title: '#8a5a00',
  },
  error: {
    bg: 'rgba(231,111,81,0.07)',       // accent-2 (terracotta) tint
    borderAccent: 'rgba(231,111,81,0.35)',
    borderSoft:   'rgba(231,111,81,0.15)',
    title: '#a13a1a',
  },
};

export default function ChefWarningBanner({
  tone,
  title,
  children,
}: {
  tone: WarningTone;
  title: string;
  children: ReactNode;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div style={{
      background: s.bg,
      borderLeft:   `2.5px solid ${s.borderAccent}`,
      borderTop:    `0.5px solid ${s.borderSoft}`,
      borderRight:  `0.5px solid ${s.borderSoft}`,
      borderBottom: `0.5px solid ${s.borderSoft}`,
      borderRadius: 'var(--radius-md)',
      padding: '9px 13px 10px',
      marginBottom: 10,
      fontVariantNumeric: 'tabular-nums',
    }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 14.5,
        color: s.title,
        lineHeight: 1.25,
        marginBottom: 2,
        fontWeight: 400,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 11.5,
        color: 'var(--text-secondary)',
        lineHeight: 1.45,
        fontFamily: 'var(--font-sans)',
      }}>
        {children}
      </div>
    </div>
  );
}
