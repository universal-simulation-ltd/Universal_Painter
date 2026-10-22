// GENERATED FILE — do not edit by hand.
// Source: backoffice/universal-platform/scripts/app-marks/marks.mjs
// Regenerate: node scripts/app-marks/build.mjs (from backoffice/universal-platform)
// Mark: Universal Painter — A brush laying down a stroke of paint; on hover the stroke paints itself.
// Hover: The brush comes down and the stroke paints itself out to it.
//
// Icon-only by design: the SDK's UniversalAppsNavBar renders the product name
// from its catalogue beside this slot, so a wordmark here would print it twice.

const CSS = `
  /* Resting states */
  .uam-painter-stroke { stroke-dashoffset: 12; transition: stroke-dashoffset .6s cubic-bezier(0.33,1,0.68,1) .1s; }
  .uam-painter-handle { transform: translate(3px, -3px); transition: transform .45s cubic-bezier(.34,1.2,.4,1); }
  .uam-painter-ferrule { transform: translate(3px, -3px); transition: transform .45s cubic-bezier(.34,1.2,.4,1); }
  .uam-painter-tip { transform: translate(3px, -3px); transition: transform .45s cubic-bezier(.34,1.2,.4,1); }

  /* Active states */
  .uam-host-painter:hover .uam-painter-stroke,
  .uam-host-painter:focus-visible .uam-painter-stroke { stroke-dashoffset: 0; }
  .uam-host-painter:hover .uam-painter-handle,
  .uam-host-painter:focus-visible .uam-painter-handle { transform: translate(0, 0); }
  .uam-host-painter:hover .uam-painter-ferrule,
  .uam-host-painter:focus-visible .uam-painter-ferrule { transform: translate(0, 0); }
  .uam-host-painter:hover .uam-painter-tip,
  .uam-host-painter:focus-visible .uam-painter-tip { transform: translate(0, 0); }

  @media (prefers-reduced-motion: reduce) {
    .uam-painter-stroke,
    .uam-painter-handle,
    .uam-painter-ferrule,
    .uam-painter-tip { transition: none !important; }
  }
`

export default function ProductLogo() {
  return (
    <span
      className="uam-host-painter inline-flex h-6 w-6 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      <style>{CSS}</style>
      <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden="true">
        <defs>
          <linearGradient id="uam-nav-painter-tile" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fe8c01" />
            <stop offset="1" stopColor="#e05504" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#uam-nav-painter-tile)" />
        <path d="M11 48c5-8 10-9 13-5s7 3 10-3" fill="none" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={34} stroke="#fed7aa" className="uam-painter-stroke" />
        <path d="M54 10 L45.6 22.8" fill="none" strokeWidth={6} strokeLinecap="round" stroke="#ffffff" className="uam-painter-handle" />
        <path d="M45 23.8 L42.9 27" fill="none" strokeWidth={9} strokeLinecap="round" stroke="#ffffff" className="uam-painter-ferrule" />
        <path d="M39.4 26.4 C37.6 31 36.4 35 35 39.5 C38.6 36.6 42.4 33.4 46 30.2 Z" fill="#ffffff" className="uam-painter-tip" />
      </svg>
    </span>
  )
}
