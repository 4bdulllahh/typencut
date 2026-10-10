"use client";

/** Menu sections; each rail button opens one as a panel. */
export type Section = "play" | "garage" | "achievements" | "board" | "settings" | "help";

// Lucide icon paths (ISC), inlined so the game keeps no icon dependency.
const ICONS: Record<Section | "sun" | "moon", React.ReactNode> = {
  play: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </>
  ),
  garage: (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  achievements: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" />
    </>
  ),
  board: <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />,
  settings: <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />,
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
};

export const SECTIONS: [Section, string][] = [
  ["play", "Mode & words"],
  ["garage", "Garage"],
  ["achievements", "Achievements"],
  ["board", "Leaderboard"],
  ["settings", "Settings"],
  ["help", "How to play"],
];

export const Icon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0" aria-hidden>
    {ICONS[name]}
  </svg>
);

const ITEM = "flex h-12 shrink-0 items-center gap-3 rounded-2xl px-2.5 sm:px-3.5 text-sm font-semibold transition-colors";

/**
 * The menu pill: icons on the far left (a row above the game on phones). Game.tsx drives `expanded` from hover and
 * focus; it widens to the right over whatever sits beside it, without moving the layout. Picking an item opens
 * that section in the sub pill (Hud.tsx `Menu`) and collapses this one.
 */
export function Rail({ open, onOpen, night, onTheme, expanded, onEnter, onLeave }: {
  open: Section | null;
  onOpen: (s: Section) => void;
  night: boolean;
  onTheme: () => void;
  expanded: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  // Labels only show on the expanded desktop pill; on phones the pill is a row of icons.
  const LABEL = `sr-only whitespace-nowrap sm:not-sr-only sm:transition-opacity ${expanded ? "sm:opacity-100" : "sm:opacity-0"}`;
  return (
    <nav
      aria-label="Menu"
      className="relative z-50 shrink-0 max-sm:flex-1 sm:w-[68px]"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onLeave()}
    >
      <div className={`flex gap-1 overflow-hidden rounded-panel border border-line bg-surface p-2.5 shadow-elev-1 max-sm:justify-around sm:absolute sm:inset-y-0 sm:left-0 sm:flex-col sm:transition-[width] sm:duration-200 ${expanded ? "sm:w-56 sm:shadow-elev-2" : "sm:w-[68px]"}`}>
        <div className="hidden h-12 shrink-0 items-center gap-3 px-2 sm:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-sm font-black italic text-stone-900">T</span>
          <span className={`${LABEL} text-base font-black italic tracking-tight`}>TYPENCUT</span>
        </div>
        {SECTIONS.map(([id, label]) => {
          const on = open === id;
          return (
            <button
              key={id}
              onClick={() => onOpen(id)}
              aria-expanded={on}
              aria-controls="game-menu"
              aria-label={label}
              className={`${ITEM} ${on ? "bg-accent-soft text-fg [&>svg]:text-accent" : "text-fg-subtle hover:bg-surface-muted hover:text-fg"}`}
            >
              <Icon name={id} />
              <span className={LABEL}>{label}</span>
            </button>
          );
        })}
        <div className="hidden flex-1 sm:block" />
        <button onClick={onTheme} aria-pressed={night} aria-label="Night mode" className={`${ITEM} text-fg-subtle hover:bg-surface-muted hover:text-fg`}>
          <Icon name={night ? "moon" : "sun"} />
          <span className={LABEL}>{night ? "Night" : "Day"}</span>
        </button>
      </div>
    </nav>
  );
}
