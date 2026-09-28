import { Button, Chip, Icon, cx, resolveSubject, type IconName, type SubjectProps } from './core';

const nbsp = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ---------- RankBadge ----------
   An original faceted hexagon medal with a sparkle, drawn as a sticker. Not a crest. */
export interface RankBadgeProps { rank: string; level: number; of?: number; size?: 'sm' | 'md' | 'lg'; hideName?: boolean }
export function RankBadge({ rank, level, of = 4, size = 'md', hideName }: RankBadgeProps) {
  const px = size === 'lg' ? 112 : size === 'sm' ? 36 : 64;
  const hex = 'M50 6L90 28V78L50 102L10 78V28Z';
  const stars = [];
  for (let i = 0; i < of; i++) stars.push(<Icon key={i} name="star" size={size === 'lg' ? 18 : 13} strokeWidth={2.5} className={i < level ? 'is-on' : undefined} />);
  return (
    <div className={cx('dk-rank', `dk-rank-${size}`)}>
      <svg className="dk-rank-medal" width={px} height={px * 1.08} viewBox="0 0 100 108" aria-hidden="true">
        <path className="dk-rank-sticker" d={hex} />
        <path className="dk-rank-face" d={hex} />
        <path className="dk-rank-shade" d="M50 6L90 28V78L50 102Z" />
        <path className="dk-rank-spark" d="M50 30c1.9 11.6 9 18.7 20.6 20.6C59 52.5 51.9 59.6 50 71.2 48.1 59.6 41 52.5 29.4 50.6 41 48.7 48.1 41.6 50 30z" />
      </svg>
      {size === 'sm' ? <span className="dk-rank-name">{rank}</span> : hideName ? null : (
        <div className="dk-rank-text">
          <div className="dk-kicker">Hodnost {level}/{of}</div>
          <div className="dk-rank-name">{rank}</div>
          <div className="dk-rank-stars" aria-label={`Úroveň ${level} ze ${of}`}>{stars}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- XpBar ---------- */
export interface XpBarProps { xp: number; from: number; to: number; nextRank?: string }
export function XpBar({ xp, from, to, nextRank }: XpBarProps) {
  const pct = Math.max(0, Math.min(100, ((xp - from) / (to - from)) * 100));
  return (
    <div className="dk-xp">
      <span className="dk-xp-bolt"><Icon name="bolt" size={22} strokeWidth={2.5} /></span>
      <div className="dk-xp-main">
        <div className="dk-xp-row">
          <span className="dk-xp-total">{nbsp(xp)}<small> XP</small></span>
          {nextRank ? <span className="dk-xp-next"><b>{nextRank}</b> za {nbsp(to - xp)} XP</span> : null}
        </div>
        <div className="dk-xp-track" role="progressbar" aria-valuemin={from} aria-valuemax={to} aria-valuenow={xp} aria-label="Zkušenosti do další hodnosti">
          <div className="dk-xp-fill" style={{ width: pct + '%' }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- SubjectTile ---------- */
export interface SubjectTileProps extends SubjectProps {
  name?: string; icon?: IconName; meta?: string; progress?: number; locked?: boolean; onClick?: () => void;
}
export function SubjectTile({ subject, accent, name, icon, meta, progress = 0, locked, onClick }: SubjectTileProps) {
  const s = resolveSubject(subject, accent, icon, name);
  return (
    <button type="button" className={cx('dk-subject', locked ? 'is-locked' : null)} style={s.style} onClick={onClick} disabled={locked}>
      <span className="dk-subject-icon"><Icon name={locked ? 'lock' : s.icon} size={30} strokeWidth={2.25} /></span>
      <span className="dk-subject-name">{s.name}</span>
      {meta ? <span className="dk-subject-meta">{locked ? 'Brzy' : meta}</span> : null}
      {!locked ? <span className="dk-subject-bar" aria-hidden="true"><span style={{ width: Math.round(progress * 100) + '%' }} /></span> : null}
      <Icon name="sparkle" size={18} className="dk-subject-spark" />
    </button>
  );
}

/* ---------- MissionCard ---------- */
const MISSION = {
  new: { chip: 'Nová', tone: 'hero' as const, cta: 'Začít', icon: 'bolt' as IconName },
  'in-progress': { chip: 'Rozdělaná', tone: 'volt' as const, cta: 'Pokračovat', icon: 'arrow' as IconName },
  complete: { chip: 'Splněno', tone: 'spark' as const, cta: 'Zopakovat', icon: 'retry' as IconName },
};
export interface MissionCardProps extends SubjectProps {
  power: string; title: string; solved: number; total?: number; state: 'new' | 'in-progress' | 'complete'; xp?: number; onStart?: () => void;
}
export function MissionCard({ subject, accent, power, title, solved, total = 10, state, xp, onStart }: MissionCardProps) {
  const s = resolveSubject(subject, accent);
  const st = MISSION[state];
  const cells = [];
  for (let i = 0; i < total; i++) cells.push(<span key={i} className={cx('dk-seg', i < solved ? 'is-on' : null)} />);
  return (
    <article className={cx('dk-mission', `dk-mission-${state}`)} style={s.style}>
      <div className="dk-mission-band">
        <span className="dk-mission-icon"><Icon name={s.icon} size={18} strokeWidth={2.5} /></span>
        <span className="dk-mission-power">{power}</span>
        <Chip tone={st.tone} icon={state === 'complete' ? 'check' : undefined}>{st.chip}</Chip>
      </div>
      <div className="dk-mission-body">
        <h3 className="dk-mission-title">{title}</h3>
        <div className="dk-mission-progress">
          <div className="dk-segs" aria-hidden="true">{cells}</div>
          <span className="dk-mission-count">{solved}/{total}</span>
        </div>
        <div className="dk-mission-foot">
          {xp ? <span className="dk-mission-xp"><Icon name="bolt" size={16} strokeWidth={2.5} />až {xp} XP</span> : <span />}
          <Button variant={state === 'complete' ? 'secondary' : 'primary'} iconAfter={st.icon} onClick={onStart}>{st.cta}</Button>
        </div>
      </div>
    </article>
  );
}

/* ---------- AttemptDots ---------- */
export interface AttemptDotsProps { used: number; total?: number }
export function AttemptDots({ used, total = 2 }: AttemptDotsProps) {
  const pips = [];
  for (let i = 0; i < total; i++) pips.push(<span key={i} className={cx('dk-pip', i < used ? 'is-used' : null)} />);
  const left = Math.max(0, total - used);
  return <span className="dk-pips" role="img" aria-label={`Zbývající pokusy: ${left} ze ${total}`}>{pips}</span>;
}
