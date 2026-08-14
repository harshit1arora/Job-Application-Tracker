export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5 22 21H2L12 2.5Z"
        fill="currentColor"
        className="text-foreground"
        opacity="0.12"
      />
      <path
        d="M3.5 20.5 12 4l8.5 16.5M8 16h8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
