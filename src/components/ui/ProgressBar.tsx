interface ProgressBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3',
};

export function ProgressBar({ value, label, showPercentage = true, size = 'md', className = '' }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-baseline mb-2 text-sm text-ink-muted">
          {label && <span>{label}</span>}
          {showPercentage && (
            <span className="text-primary font-bold text-lg">{clampedValue.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-border rounded-full overflow-hidden">
        <div
          className={`bg-primary transition-all duration-300 ease-in-out ${sizeStyles[size]}`}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
