import React from 'react';

type Step = 'upload' | 'processing' | 'mapping';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'upload',     label: 'Upload',       icon: '📷' },
  { key: 'processing', label: 'Processando',  icon: '⚙️' },
  { key: 'mapping',    label: 'Mapeamento',   icon: '🔤' },
];

const ORDER: Step[] = ['upload', 'processing', 'mapping'];

interface Props { current: Step; }

export function StepIndicator({ current }: Props) {
  const currentIndex = ORDER.indexOf(current);

  return (
    <nav style={s.nav}>
      <div style={s.inner}>
        {STEPS.map(({ key, label, icon }, i) => {
          const isDone   = i < currentIndex;
          const isActive = key === current;
          return (
            <div key={key} style={s.item}>
              <div style={{
                ...s.circle,
                background: isDone ? '#22c55e' : isActive ? '#667eea' : '#e5e5e5',
                color: isDone || isActive ? '#fff' : '#999',
              }}>
                {isDone ? '✓' : icon}
              </div>
              <span style={{
                ...s.label,
                color: isActive ? '#667eea' : isDone ? '#22c55e' : '#999',
                fontWeight: isActive ? 700 : 400,
              }}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div style={{
                  ...s.line,
                  background: isDone ? '#22c55e' : '#e5e5e5',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  nav:    { background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '16px 20px' },
  inner:  { display: 'flex', alignItems: 'center', maxWidth: 600, margin: '0 auto' },
  item:   { display: 'flex', alignItems: 'center', flex: 1 },
  circle: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all .3s' },
  label:  { fontSize: 13, marginLeft: 8, whiteSpace: 'nowrap', transition: 'all .3s' },
  line:   { flex: 1, height: 2, margin: '0 8px', transition: 'background .3s' },
};