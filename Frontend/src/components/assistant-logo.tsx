export function JobPilotLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="jpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hexagonal / Shield AI Badge */}
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="10"
        fill="url(#jpGrad)"
      />
      <rect
        x="3"
        y="3"
        width="30"
        height="30"
        rx="9"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
      />

      {/* Pilot / Jet Wings Geometry */}
      <path
        d="M18 7L27 21H22L18 16L14 21H9L18 7Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M18 18L24 28H20L18 24L16 28H12L18 18Z"
        fill="white"
        fillOpacity="0.75"
      />

      {/* Center AI Core Pulse */}
      <circle cx="18" cy="19" r="2.5" fill="#38bdf8" />
      <circle cx="18" cy="19" r="1.2" fill="white" />

      {/* Sparkle top right */}
      <path
        d="M28 6L28.8 8.2L31 9L28.8 9.8L28 12L27.2 9.8L25 9L27.2 8.2L28 6Z"
        fill="url(#sparkleGrad)"
        filter="url(#glow)"
      />
    </svg>
  );
}

export function PlatformLogo({
  platform,
  className = "h-4 w-4",
}: {
  platform: "greenhouse" | "lever" | "workday" | "ashby" | "linkedin" | "indeed" | "general";
  className?: string;
}) {
  switch (platform) {
    case "greenhouse":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect width="24" height="24" rx="5" fill="#00B27A" />
          <path d="M7 16V8h3c2.2 0 4 1.8 4 4s-1.8 4-4 4H7zm3-2.5c1 0 1.8-.8 1.8-1.5s-.8-1.5-1.8-1.5H9.2v3H10z" fill="white" />
        </svg>
      );
    case "lever":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect width="24" height="24" rx="5" fill="#202A36" />
          <path d="M6 7h3v10H6zm9 0h3v10h-3zm-4.5 4h3v6h-3z" fill="#00D39B" />
        </svg>
      );
    case "workday":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect width="24" height="24" rx="5" fill="#005CB9" />
          <path d="M7 8l3 8 2-5 2 5 3-8h-2.2l-1.8 5-1.8-5h-1.4l-1.8 5L7.2 8H7z" fill="white" />
        </svg>
      );
    case "ashby":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect width="24" height="24" rx="5" fill="#1C1E21" />
          <path d="M12 5l6 14H6l6-14zm0 4.5L8.5 17h7L12 9.5z" fill="#FF5E62" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect width="24" height="24" rx="5" fill="#0A66C2" />
          <path d="M7 9h2.5v8H7zm1.25-4a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zM11.5 9H14v1.1c.5-.7 1.4-1.3 2.6-1.3 2.4 0 3.4 1.5 3.4 3.8V17h-2.5v-3.9c0-1-.4-1.7-1.5-1.7-1 0-1.5.8-1.5 1.7V17h-2.5V9z" fill="white" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect width="24" height="24" rx="5" fill="#6366F1" />
          <circle cx="12" cy="12" r="5" fill="white" />
        </svg>
      );
  }
}
