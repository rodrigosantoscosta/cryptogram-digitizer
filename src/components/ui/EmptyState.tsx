import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-20 px-5 ${className}`}>
      <div className="text-ink-faint mb-4 flex justify-center">{icon}</div>
      <h2 className="text-2xl font-semibold text-ink mb-2">{title}</h2>
      {description && (
        <p className="text-ink-muted text-base mb-6">{description}</p>
      )}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}
