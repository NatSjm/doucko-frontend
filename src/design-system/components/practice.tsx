import * as React from 'react';
import { Button, Icon, SubjectChip, cx, resolveSubject, type ButtonProps, type IconName, type SubjectProps } from './core';
import { AttemptDots } from './game';

/* Toggle wording per task locale. Add a locale here when its translations arrive. */
const LANG: Record<string, { show: string; hide: string; code: string }> = {
  uk: { show: 'Zobrazit ukrajinsky', hide: 'Skrýt ukrajinštinu', code: 'UK' },
  ru: { show: 'Zobrazit rusky', hide: 'Skrýt ruštinu', code: 'RU' },
  en: { show: 'Zobrazit anglicky', hide: 'Skrýt angličtinu', code: 'EN' },
};

/* ---------- TaskPrompt ---------- */
export interface TaskPromptProps extends SubjectProps {
  power?: string; kicker?: string; attempts?: number;
  prompt: React.ReactNode; translation?: React.ReactNode; translationLang?: string;
  showTranslation?: boolean; onToggleTranslation?: () => void; onReport?: () => void; children?: React.ReactNode;
}
export function TaskPrompt({ subject, accent, power, kicker, attempts, prompt, translation, translationLang = 'uk', showTranslation, onToggleTranslation, onReport, children }: TaskPromptProps) {
  const s = resolveSubject(subject, accent);
  const l = LANG[translationLang] ?? { show: 'Zobrazit překlad', hide: 'Skrýt překlad', code: translationLang.toUpperCase() };
  return (
    <section className="dk-card dk-task" style={s.style}>
      <header className="dk-task-head">
        {subject || accent ? <SubjectChip subject={subject} accent={accent} size="sm" /> : null}
        {power ? <span className="dk-task-power">{power}</span> : null}
        <span className="dk-task-spacer" />
        {kicker ? <span className="dk-kicker">{kicker}</span> : null}
        {attempts != null ? <AttemptDots used={attempts} /> : null}
      </header>
      <div className="dk-prompt" lang="cs">{prompt}</div>
      {children}
      {translation && showTranslation ? (
        <div className="dk-alt" lang={translationLang}>
          <span className="dk-alt-code">{l.code}</span>
          <div className="dk-alt-text">{translation}</div>
        </div>
      ) : null}
      {translation || onReport ? (
        <footer className="dk-task-tools">
          {translation ? (
            <button type="button" className={cx('dk-toggle', showTranslation ? 'is-on' : null)} aria-pressed={!!showTranslation} onClick={onToggleTranslation}>
              <Icon name="translate" size={18} strokeWidth={2.25} />{showTranslation ? l.hide : l.show}
            </button>
          ) : <span />}
          {onReport ? <button type="button" className="dk-link" onClick={onReport}><Icon name="flag" size={16} />Nahlásit problém</button> : null}
        </footer>
      ) : null}
    </section>
  );
}

/* ---------- AnswerPart ---------- */
const PART: Record<string, { icon: IconName; sr: string }> = {
  correct: { icon: 'check', sr: 'Správně' },
  wrong: { icon: 'retry', sr: 'Zkus znovu' },
  revealed: { icon: 'eye', sr: 'Správná odpověď' },
};
export interface AnswerPartProps {
  label?: string; id?: string; value?: string; onChange?: React.ChangeEventHandler<HTMLInputElement>;
  state?: 'idle' | 'correct' | 'wrong' | 'revealed'; unit?: string; correctValue?: string; placeholder?: string;
  inputMode?: 'decimal' | 'text' | 'numeric';
}
export function AnswerPart({ label, id, value, onChange, state = 'idle', unit, correctValue, placeholder = 'Tvoje odpověď', inputMode = 'decimal' }: AnswerPartProps) {
  const fid = id ?? `dk-part-${label ?? 'x'}`;
  const revealed = state === 'revealed';
  const p = PART[state];
  return (
    <div className={cx('dk-part', `dk-part-${state}`, label ? null : 'no-label')}>
      {label ? <label className="dk-part-label" htmlFor={fid}>{label}</label> : null}
      <div className="dk-part-field">
        <input id={fid} className="dk-input" inputMode={inputMode} autoComplete="off" spellCheck={false}
          value={revealed ? correctValue ?? '' : value ?? ''} readOnly={revealed || state === 'correct'}
          placeholder={placeholder} onChange={onChange} aria-invalid={state === 'wrong' ? true : undefined}
          aria-label={label ? undefined : 'Odpověď'} />
        {unit ? <span className="dk-unit">{unit}</span> : null}
        {p ? <span className="dk-part-state"><Icon name={p.icon} size={18} strokeWidth={3} /><span className="dk-sr">{p.sr}</span></span> : null}
      </div>
      {revealed && value ? <div className="dk-part-note">Tvoje odpověď: <b>{value}</b></div> : null}
    </div>
  );
}

/* ---------- ChoiceGroup ---------- */
export interface ChoiceOption { value: string; label: React.ReactNode }
export interface ChoiceGroupProps {
  name: string; legend?: string; options: ChoiceOption[]; multiple?: boolean;
  value: string[]; onChange?: (value: string[]) => void;
  /** After checking: per option value, how it turned out. */
  result?: Record<string, 'correct' | 'wrong' | 'missed'>; disabled?: boolean;
}
export function ChoiceGroup({ name, legend, options, multiple, value, onChange, result, disabled }: ChoiceGroupProps) {
  const toggle = (v: string) => {
    if (!onChange) return;
    if (!multiple) return onChange([v]);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <fieldset className="dk-choices" disabled={disabled}>
      {legend ? <legend className="dk-choices-legend">{legend}</legend> : null}
      {multiple ? <div className="dk-choices-hint">Vyber všechny správné možnosti.</div> : null}
      {options.map((o, i) => {
        const r = result?.[o.value];
        const on = value.includes(o.value);
        return (
          <label key={o.value} className={cx('dk-choice', on ? 'is-selected' : null, r ? `dk-choice-${r}` : null)}>
            <input className="dk-sr" type={multiple ? 'checkbox' : 'radio'} name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} />
            <span className="dk-choice-key">{String.fromCharCode(65 + i)}</span>
            <span className="dk-choice-label">{o.label}</span>
            {r === 'correct' ? <span className="dk-choice-state"><Icon name="check" size={18} strokeWidth={3} /><span className="dk-sr">Správně</span></span> : null}
            {r === 'wrong' ? <span className="dk-choice-state"><Icon name="retry" size={18} strokeWidth={3} /><span className="dk-sr">Tohle ne</span></span> : null}
            {r === 'missed' ? <span className="dk-choice-state"><Icon name="eye" size={18} strokeWidth={3} /><span className="dk-sr">Tohle patřilo mezi správné</span></span> : null}
          </label>
        );
      })}
    </fieldset>
  );
}

/* ---------- Feedback ---------- */
const FB: Record<string, { icon: IconName; title: string }> = {
  correct: { icon: 'check', title: 'Správně!' },
  almost: { icon: 'retry', title: 'Skoro! Zkus to znovu.' },
  revealed: { icon: 'eye', title: 'Nevadí, příště!' },
  format: { icon: 'hint', title: 'Tohle neumím přečíst' },
};
export interface FeedbackProps { kind: 'correct' | 'almost' | 'revealed' | 'format'; title?: string; xp?: number; children?: React.ReactNode }
export function Feedback({ kind, title, xp, children }: FeedbackProps) {
  const f = FB[kind];
  return (
    <div className={cx('dk-fb', `dk-fb-${kind}`)} role="status">
      <span className="dk-fb-icon"><Icon name={f.icon} size={22} strokeWidth={3} /></span>
      <div className="dk-fb-body">
        <div className="dk-fb-title">{title ?? f.title}</div>
        {children ? <div className="dk-fb-text">{children}</div> : null}
      </div>
      {kind === 'correct' && xp ? (
        <div className="dk-burst" aria-label={`+${xp} XP`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <path className="dk-burst-sticker" d="M60 8l10 20 21-10-4 23 23 4-16 17 16 17-23 4 4 23-21-10-10 20-10-20-21 10 4-23-23-4 16-17L10 45l23-4-4-23 21 10z" />
            <path className="dk-burst-face" d="M60 8l10 20 21-10-4 23 23 4-16 17 16 17-23 4 4 23-21-10-10 20-10-20-21 10 4-23-23-4 16-17L10 45l23-4-4-23 21 10z" />
          </svg>
          <span className="dk-burst-num">+{xp}<small>XP</small></span>
          <Icon name="sparkle" size={16} className="dk-burst-s1" />
          <Icon name="sparkle" size={12} className="dk-burst-s2" />
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Hints ---------- */
export interface HintButtonProps extends Omit<ButtonProps, 'variant' | 'icon'> { used: number; total: number }
export function HintButton({ used, total, disabled, ...rest }: HintButtonProps) {
  return (
    <Button {...rest} variant="secondary" icon="hint" disabled={disabled || used >= total}>
      Nápověda <span className="dk-count">{used}/{total}</span>
    </Button>
  );
}

export interface HintCardProps { index: number; total?: number; children: React.ReactNode }
export function HintCard({ index, total, children }: HintCardProps) {
  return (
    <div className="dk-hint">
      <span className="dk-hint-icon"><Icon name="hint" size={20} strokeWidth={2.5} /></span>
      <div>
        <div className="dk-kicker">Nápověda {index}{total ? ` z ${total}` : ''}</div>
        <div className="dk-hint-text">{children}</div>
      </div>
    </div>
  );
}
