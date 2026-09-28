export function MetaBrainLogo({
  size = "md",
  className = "",
  showText = false,
  subtitle,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
  subtitle?: string;
}) {
  const dim =
    size === "sm"
      ? "h-6 w-6"
      : size === "lg"
        ? "h-12 w-12"
        : size === "xl"
          ? "h-16 w-16"
          : "h-8 w-8";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          className={dim}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="mbGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <filter id="mbGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Brain Circuitry Outline */}
          <path
            d="M24 6.5C17.2 6.5 11.5 11.8 11.5 18.5C11.5 22.2 13.2 25.4 15.8 27.5C13.8 29.1 12.5 31.8 12.5 35C12.5 39.7 16.3 43.5 21 43.5C22 43.5 23 43.3 24 43M24 6.5C30.8 6.5 36.5 11.8 36.5 18.5C36.5 22.2 34.8 25.4 32.2 27.5C34.2 29.1 35.5 31.8 35.5 35C35.5 39.7 31.7 43.5 27 43.5C26 43.5 25 43.3 24 43M24 6.5V43"
            stroke="url(#mbGoldGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Internal Convolutions */}
          <path
            d="M17.5 14.5C19.5 13 22 13.5 24 15.5M30.5 14.5C28.5 13 26 13.5 24 15.5M16 23C19 23 21 25 24 25M32 23C29 23 27 25 24 25M17.5 32.5C19.5 31.5 22 32.5 24 34.5M30.5 32.5C28.5 31.5 26 32.5 24 34.5"
            stroke="url(#mbGoldGrad)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Central Nodes */}
          <circle cx="24" cy="15.5" r="1.8" fill="#FDE68A" />
          <circle cx="24" cy="25" r="1.8" fill="#FDE68A" />
          <circle cx="24" cy="34.5" r="1.8" fill="#FDE68A" />
          {/* Peripheral Synapse Nodes */}
          <circle cx="17.5" cy="14.5" r="1.4" fill="#F59E0B" />
          <circle cx="30.5" cy="14.5" r="1.4" fill="#F59E0B" />
          <circle cx="16" cy="23" r="1.4" fill="#F59E0B" />
          <circle cx="32" cy="23" r="1.4" fill="#F59E0B" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span className="text-base font-bold tracking-tight leading-tight text-foreground font-sans">
            MetaBrain <span className="text-amber-400">Trader</span>
          </span>
          {subtitle && (
            <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground leading-none">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
