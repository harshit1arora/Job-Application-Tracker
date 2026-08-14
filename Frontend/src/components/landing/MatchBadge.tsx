export function MatchBadge({ score, size = 40 }: { score: number; size?: number }) {
  const tone =
    score >= 70
      ? "text-emerald-600"
      : score >= 60
        ? "text-amber-600"
        : "text-muted-foreground";
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          className={tone}
        />
      </svg>
      <span className={`absolute text-[10px] font-semibold ${tone}`}>{score}%</span>
    </span>
  );
}
