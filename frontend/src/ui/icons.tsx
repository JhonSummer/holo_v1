// Shared inline SVG icons (stroke = currentColor so buttons tint them).

// Brand mark: three concentric arcs orbiting a luminous core (see branding/).
// This is the small-size drawing — thicker strokes, no taper — which the brand
// sheet prescribes below 20px; both in-app uses sit around that size.
export function HoloMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="29.74 0.30 77.90 77.90"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="hm1" gradientUnits="userSpaceOnUse" x1="15" y1="105" x2="105" y2="15">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="65%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#2E7CF6" />
        </linearGradient>
        <linearGradient id="hm2" gradientUnits="userSpaceOnUse" x1="27" y1="93" x2="93" y2="27">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="65%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="hm3" gradientUnits="userSpaceOnUse" x1="38.5" y1="81.5" x2="81.5" y2="38.5">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="65%" stopColor="#D946EF" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
        <radialGradient id="hmCore" cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="42%" stopColor="#EBD6FF" />
          <stop offset="100%" stopColor="#9333EA" />
        </radialGradient>
      </defs>
      <path d="M 96.144 33.194 A 45 45 0 0 0 66.603 15.487" fill="none" stroke="url(#hm1)" strokeWidth="10" strokeLinecap="round" />
      <path d="M 77.518 32.034 A 33 33 0 0 0 48.477 29.077" fill="none" stroke="url(#hm2)" strokeWidth="11.5" strokeLinecap="round" />
      <path d="M 62.457 38.641 A 21.5 21.5 0 0 0 42.731 47.192" fill="none" stroke="url(#hm3)" strokeWidth="13" strokeLinecap="round" />
      <circle cx="60" cy="60" r="8" fill="url(#hmCore)" />
    </svg>
  )
}

export function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </svg>
  )
}

export function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92A8.78 8.78 0 0 0 17.64 9.2z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}
