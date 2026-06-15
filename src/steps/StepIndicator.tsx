import React from 'react';
import { Camera, Settings, Type, Check } from 'lucide-react';

type Step = 'upload' | 'processing' | 'mapping';

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'upload',     label: 'Upload',       icon: <Camera size={16} /> },
  { key: 'processing', label: 'Processando',  icon: <Settings size={16} /> },
  { key: 'mapping',    label: 'Mapeamento',   icon: <Type size={16} /> },
];

const ORDER: Step[] = ['upload', 'processing', 'mapping'];

interface Props { current: Step; }

export function StepIndicator({ current }: Props) {
  const currentIndex = ORDER.indexOf(current);

  return (
    <nav className="bg-surface-card border-b border-border py-4 px-5">
      <div className="flex items-center max-w-xl mx-auto">
        {STEPS.map(({ key, label, icon }, i) => {
          const isDone   = i < currentIndex;
          const isActive = key === current;
          return (
            <div key={key} className="flex items-center flex-1">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                transition-all duration-300 text-white
                ${isDone ? 'bg-success' : isActive ? 'bg-primary' : 'bg-border text-ink-faint'}
              `}>
                {isDone ? <Check size={16} /> : icon}
              </div>
              <span className={`
                text-sm ml-2 whitespace-nowrap transition-all duration-300
                ${isActive ? 'text-primary font-bold' : isDone ? 'text-success font-medium' : 'text-ink-faint'}
              `}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`
                  flex-1 h-0.5 mx-2 transition-colors duration-300
                  ${isDone ? 'bg-success' : 'bg-border'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
