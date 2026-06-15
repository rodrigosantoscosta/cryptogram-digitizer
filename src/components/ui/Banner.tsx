import type { ReactNode } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

export type BannerVariant = 'success' | 'error' | 'warning' | 'info';

interface BannerProps {
  children: ReactNode;
  variant: BannerVariant;
  className?: string;
}

const variantStyles: Record<BannerVariant, string> = {
  success: 'bg-success-bg border-success-border text-success-text',
  error:   'bg-error-bg border-error-border text-error-text',
  warning: 'bg-warning-bg border-warning/30 text-warning-text',
  info:    'bg-primary-active border-primary/30 text-primary',
};

const iconMap: Record<BannerVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Banner({ children, variant, className = '' }: BannerProps) {
  const Icon = iconMap[variant];

  return (
    <div
      className={`flex items-start gap-3 rounded-input border p-4 text-sm ${variantStyles[variant]} ${className}`}
      role="alert"
    >
      <Icon size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
