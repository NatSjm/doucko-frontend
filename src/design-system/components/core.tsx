import * as React from 'react';

/* ---------- helpers ---------- */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------- subjects ----------
   Subjects are data, not code: add one here (or pass `accent` + `icon` directly)
   and give it a `subject-<key>` colour token. */
export type IconName =
  | 'check' | 'retry' | 'hint' | 'translate' | 'flag' | 'star' | 'sparkle' | 'arrow' | 'eye' | 'bolt' | 'lock'
  | 'math' | 'book' | 'chat' | 'leaf' | 'globe' | 'temple';

export interface SubjectDef { name: string; icon: IconName; token: string }

export const SUBJECTS: Record<string, SubjectDef> = {
  math: { name: 'Matematika', icon: 'math', token: 'subject-math' },
  czech: { name: 'Český jazyk', icon: 'book', token: 'subject-czech' },
  english: { name: 'Anglický jazyk', icon: 'chat', token: 'subject-english' },
  biology: { name: 'Přírodopis', icon: 'leaf', token: 'subject-biology' },
  geography: { name: 'Zeměpis', icon: 'globe', token: 'subject-geography' },
  history: { name: 'Dějepis', icon: 'temple', token: 'subject-history' },
};

export interface SubjectProps {
  /** Key in SUBJECTS (math, czech, english, biology, geography, history). */
  subject?: string;
  /** Override the colour: a token name ("subject-math", "pink") or any CSS colour. */
  accent?: string;
}

export function resolveSubject(subject?: string, accent?: string, icon?: IconName, name?: string) {
  const def = subject ? SUBJECTS[subject] : undefined;
  const a = accent ?? def?.token ?? 'blue';
  const color = /^[a-z][a-z0-9-]*$/.test(a) ? `var(--${a})` : a;
  return {
    name: name ?? def?.name ?? subject ?? '',
    icon: icon ?? def?.icon ?? 'star',
    style: { ['--dk-accent' as string]: color } as React.CSSProperties,
  };
}

/* ---------- Icon ---------- */
const PATHS: Record<IconName, string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  retry: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  translate: 'M3 5h10M8 3v2M5 5c1 4 4 7 8 8M11 5c-1 4-4 7-8 8M13 21l4-9 4 9M14.5 18h5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  sparkle: 'M12 3c.8 5 3.9 8.1 9 9-5.1.9-8.2 4-9 9-.8-5-3.9-8.1-9-9 5.1-.9 8.2-4 9-9z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  math: 'M7 4v6M4 7h6M14 7h6M4.5 14.5l5 5M9.5 14.5l-5 5M14 17h6M17 14v.01M17 20v.01',
  book: 'M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5zM12 6v13.5',
  chat: 'M4 5h16v11h-9l-5 4v-4H4zM8 9h8M8 12h5',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 12h17M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  temple: 'M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18',
};
export const ICONS = Object.keys(PATHS) as IconName[];

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; label?: string; className?: string }
export function Icon({ name, size = 20, strokeWidth = 2.25, label, className }: IconProps) {
  return (
    <svg className={cx('dk-icon', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={PATHS[name] ?? PATHS.star} />
    </svg>
  );
}

/* ---------- Button ---------- */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  icon?: IconName;
  iconAfter?: IconName;
}
export function Button({ variant = 'secondary', size = 'md', icon, iconAfter, className, children, type = 'button', ...rest }: ButtonProps) {
  const s = size === 'lg' ? 22 : 18;
  return (
    <button type={type} {...rest} className={cx('dk-btn', `dk-btn-${variant}`, `dk-btn-${size}`, className)}>
      {icon ? <Icon name={icon} size={s} strokeWidth={2.5} /> : null}
      <span>{children}</span>
      {iconAfter ? <Icon name={iconAfter} size={s} strokeWidth={2.5} /> : null}
    </button>
  );
}

/* ---------- Chip ---------- */
export interface ChipProps { tone?: 'neutral' | 'hero' | 'volt' | 'spark' | 'almost' | 'ink'; icon?: IconName; children?: React.ReactNode; className?: string }
export function Chip({ tone = 'neutral', icon, children, className }: ChipProps) {
  return (
    <span className={cx('dk-chip', `dk-chip-${tone}`, className)}>
      {icon ? <Icon name={icon} size={14} strokeWidth={2.75} /> : null}
      {children}
    </span>
  );
}

/* ---------- SubjectChip ---------- */
export interface SubjectChipProps extends SubjectProps { name?: string; icon?: IconName; size?: 'sm' | 'md' }
export function SubjectChip({ subject, accent, name, icon, size = 'md' }: SubjectChipProps) {
  const s = resolveSubject(subject, accent, icon, name);
  return (
    <span className={cx('dk-subject-chip', `dk-subject-chip-${size}`)} style={s.style}>
      <span className="dk-subject-dot"><Icon name={s.icon} size={size === 'sm' ? 14 : 16} strokeWidth={2.5} /></span>
      {s.name}
    </span>
  );
}

/* ---------- Panel ---------- */
export interface PanelProps extends SubjectProps {
  kicker?: React.ReactNode; title?: React.ReactNode; tone?: 'default' | 'hero' | 'volt' | 'subject';
  ariaLabel?: string; className?: string; children?: React.ReactNode;
}
export function Panel({ kicker, title, tone = 'default', subject, accent, ariaLabel, className, children }: PanelProps) {
  const s = tone === 'subject' ? resolveSubject(subject, accent) : null;
  return (
    <section className={cx('dk-panel', `dk-panel-${tone}`, className)} style={s?.style} aria-label={ariaLabel}>
      {kicker ? <div className="dk-kicker">{kicker}</div> : null}
      {title ? <h2 className="dk-panel-title">{title}</h2> : null}
      {children}
    </section>
  );
}
