import type { ReactNode } from 'react';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success-text border-success-border',
  error:   'bg-error-bg text-error-text border-error-border',
  warning: 'bg-warning-bg text-warning-text border-warning/30',
  info:    'bg-primary-active text-primary border-primary/30',
  default: 'bg-surface-subtle text-ink-muted border-border',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
