import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  secondary: 'bg-surface-card text-ink border border-border hover:bg-surface-subtle active:bg-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  danger:    'bg-error text-white hover:bg-error/90 active:bg-error focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2',
  ghost:     'bg-transparent text-ink-muted hover:bg-surface-subtle hover:text-ink active:bg-border focus-visible:ring-2 focus-visible:ring-primary',
  success:   'bg-success text-white hover:bg-success/90 active:bg-success focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-input',
  md: 'px-4 py-2.5 text-sm rounded-input',
  lg: 'px-6 py-3.5 text-base rounded-card',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', children, fullWidth, className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          'inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? 'w-full' : '',
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
