export interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress" aria-label={label}>
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${percentage}%` }} />
      </div>
      <strong className="progress__label">{label}</strong>
    </div>
  );
}
