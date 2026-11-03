export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <circle cx="24" cy="18" r="6.5" fill="currentColor" />
      <g stroke="currentColor" strokeLinecap="round">
        <path d="M24 5.5v3.2" strokeWidth="2" />
        <path d="M13.5 9.6l2.1 2.4" strokeWidth="1.6" opacity=".65" />
        <path d="M34.5 9.6l-2.1 2.4" strokeWidth="1.6" opacity=".65" />
        <path d="M8 22.4h3.2" strokeWidth="1.6" opacity=".65" />
        <path d="M36.8 22.4H40" strokeWidth="1.6" opacity=".65" />
      </g>
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="2" fill="none">
        <path
          d="M7 30.5c4.6-3.8 9.1-3.8 13.7 0 4.6 3.8 9.1 3.8 13.7 0 2.2-1.8 4.4-2.8 6.6-2.9"
          opacity=".95"
        />
        <path
          d="M7 38c4.6-3.8 9.1-3.8 13.7 0 4.6 3.8 9.1 3.8 13.7 0 2.2-1.8 4.4-2.8 6.6-2.9"
          opacity=".55"
        />
      </g>
    </svg>
  );
}
