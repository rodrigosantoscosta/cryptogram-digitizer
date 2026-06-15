import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  default:  'bg-surface-card border border-border',
  elevated: 'bg-surface-card shadow-elevated border border-border-light',
  bordered: 'bg-surface-card border-2 border-border',
};

const paddingStyles: Record<string, string> = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, variant = 'default', padding = 'md', className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-card ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
