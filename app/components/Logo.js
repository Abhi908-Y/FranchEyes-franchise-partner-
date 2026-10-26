// FranchEyes logo: an eye with a location pin for a pupil. Same drawing as app/icon.svg (the browser-tab icon).
export default function Logo({ size = 36 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="22" fill="#14213f" />
      <path d="M12 52 Q50 16 88 52 Q50 88 12 52 Z" fill="none" stroke="#ffffff" strokeWidth="6.5" strokeLinejoin="round" />
      <path d="M50 70 C44 62 36 55 36 44 A14 14 0 1 1 64 44 C64 55 56 62 50 70 Z" fill="#f47a35" />
      <circle cx="50" cy="44" r="5.5" fill="#14213f" />
    </svg>
  );
}
