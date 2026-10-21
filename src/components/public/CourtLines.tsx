/** Decorative arena-floor markings: a center circle and rink face-off lines. */
export default function CourtLines() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -right-40 top-1/2 -z-10 hidden h-[44rem] w-[44rem] -translate-y-1/2 opacity-[0.13] md:block"
      viewBox="0 0 600 600"
      fill="none"
      stroke="#F8EEF7"
      strokeWidth="3"
    >
      <circle cx="300" cy="300" r="90" />
      <circle cx="300" cy="300" r="22" />
      <circle cx="300" cy="300" r="250" strokeDasharray="6 14" />
      <line x1="300" y1="0" x2="300" y2="600" />
      <line x1="40" y1="160" x2="560" y2="160" strokeWidth="6" />
      <line x1="40" y1="440" x2="560" y2="440" strokeWidth="6" />
      <circle cx="150" cy="90" r="34" />
      <circle cx="450" cy="510" r="34" />
    </svg>
  );
}
