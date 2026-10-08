interface ResourceBarProps {
  label: string;
  current: number;
  max: number;
  /** Tailwind background class of the filled part. */
  color: string;
}

/** A labelled current/max bar (HP, energy). */
export function ResourceBar({ label, current, max, color }: ResourceBarProps) {
  const percent = max > 0 ? Math.round((current / max) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>
          {current}/{max}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        className="h-2 overflow-hidden rounded bg-gray-200"
      >
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
