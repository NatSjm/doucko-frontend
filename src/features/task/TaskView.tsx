import { useId, useState, type ReactNode } from 'react';
import type { components } from '@/api/generated/schema';
import { Button, cx, Icon } from '@/design-system';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import './task.css';

type S = components['schemas'];
export type TaskViewData = S['TaskView'];
type LocalizedText = S['LocalizedText'];

/** Czech text with its translation, when one is on, after it in its own language (FR-8). */
function Localized({ text, className }: { text: LocalizedText; className?: string }) {
  return (
    <>
      <span data-content className={className}>
        {text.cs}
      </span>
      {text.secondary && (
        <span className="task-alt-inline" lang={text.secondary.locale} data-content>
          {text.secondary.text}
        </span>
      )}
    </>
  );
}

const NUMERIC_INPUT: Partial<Record<S['AnswerType'], 'decimal'>> = {
  INTEGER: 'decimal',
  DECIMAL: 'decimal',
  FRACTION: 'decimal',
  NUMBER_WITH_UNIT: 'decimal',
};

/** One answer part: a typed field (with its unit), or lettered options for the choice types. */
function Part({ part }: { part: S['PartView'] }) {
  const t = useT();
  const id = useId();
  const [value, setValue] = useState<string[]>([]);
  if (part.type === 'CHOICE_SINGLE' || part.type === 'CHOICE_MULTI') {
    const multiple = part.type === 'CHOICE_MULTI';
    return (
      <fieldset className="dk-choices">
        <legend className="dk-choices-legend">
          <Localized text={part.label} />
        </legend>
        {multiple && <div className="dk-choices-hint">{t('child.task.chooseAll')}</div>}
        {(part.options ?? []).map((o) => {
          const on = value.includes(o.key);
          return (
            <label key={o.key} className={cx('dk-choice', on ? 'is-selected' : null)}>
              <input
                className="dk-sr"
                type={multiple ? 'checkbox' : 'radio'}
                name={`${id}-${part.key}`}
                checked={on}
                onChange={() => setValue(!multiple ? [o.key] : on ? value.filter((k) => k !== o.key) : [...value, o.key])}
              />
              <span className="dk-choice-key">{o.key}</span>
              <span className="dk-choice-label">
                <Localized text={o.text} />
              </span>
            </label>
          );
        })}
      </fieldset>
    );
  }
  return (
    <div className="dk-part">
      <label className="dk-part-label" htmlFor={id}>
        <Localized text={part.label} />
      </label>
      <div className="dk-part-field">
        <input
          id={id}
          className="dk-input"
          inputMode={NUMERIC_INPUT[part.type] ?? 'text'}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('child.task.answerPlaceholder')}
          value={value[0] ?? ''}
          onChange={(e) => setValue([e.target.value])}
        />
        {part.unit && (
          <span className="dk-unit" data-content>
            {part.unit}
          </span>
        )}
      </div>
    </div>
  );
}

/** Hints open one at a time, in order; there is no control at all without hints (FR-7). */
function Hints({ hints }: { hints: S['HintState'] }) {
  const t = useT();
  const [opened, setOpened] = useState(0);
  if (!hints.total) return null;
  return (
    <div className="task-hints">
      <div>
        <Button icon="hint" disabled={opened >= hints.opened.length} onClick={() => setOpened((n) => n + 1)}>
          {t('child.task.hint')}{' '}
          <span className="dk-count">
            {opened}/{hints.total}
          </span>
        </Button>
      </div>
      {hints.opened.slice(0, opened).map((hint) => (
        <div key={hint.index} className="dk-hint">
          <span className="dk-hint-icon">
            <Icon name="hint" size={20} strokeWidth={2.5} />
          </span>
          <div>
            <div className="dk-kicker">{format(t('child.task.hintOf'), { n: hint.index, total: hints.total })}</div>
            <div className="dk-hint-text">
              <Localized text={hint.text} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The task area as the child sees it (practice-flow "Task screen"; content-authoring "Preview and
 * answer tester"): Czech prompt, images in order, answer parts, hints, and the translation toggle.
 * Fed with the `TaskView` shape; images are drawn by `renderImage`, so each app fetches them its way.
 * It never shows a source reference (OQ-7).
 */
export function TaskView({
  task,
  showTranslation,
  onToggleTranslation,
  renderImage,
}: {
  task: TaskViewData;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  renderImage: (image: TaskViewData['images'][number], index: number) => ReactNode;
}) {
  const t = useT();
  return (
    <section className="dk-card dk-task task-view" lang="cs">
      <div className="dk-prompt" data-content>
        {task.prompt.cs}
      </div>
      {task.prompt.secondary && (
        <div className="dk-alt" lang={task.prompt.secondary.locale}>
          <div className="dk-alt-text" data-content>
            {task.prompt.secondary.text}
          </div>
        </div>
      )}
      {task.images.length > 0 && <div className="task-images">{task.images.map(renderImage)}</div>}
      {task.parts.map((part) => (
        <Part key={part.key} part={part} />
      ))}
      <Hints hints={task.hints} />
      {task.translationAvailable && (
        <footer className="dk-task-tools">
          <button type="button" className={cx('dk-toggle', showTranslation ? 'is-on' : null)} aria-pressed={showTranslation} onClick={onToggleTranslation}>
            <Icon name="translate" size={18} strokeWidth={2.25} />
            {t(showTranslation ? 'child.task.hideTranslation' : 'child.task.showTranslation')}
          </button>
        </footer>
      )}
    </section>
  );
}
