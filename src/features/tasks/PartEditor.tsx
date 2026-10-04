import { Button } from '@/design-system';
import { Field } from '@/features/admin-access/form';
import { useT, type MessageKey } from '@/i18n';
import { format } from '@/i18n/format';
import { CHOICE_TYPES, optionKey, type AnswerType, type PartForm } from './taskForm';

const TYPES: AnswerType[] = ['INTEGER', 'DECIMAL', 'FRACTION', 'NUMBER_WITH_UNIT', 'CHOICE_SINGLE', 'CHOICE_MULTI', 'TEXT'];
const NUMERIC: AnswerType[] = ['INTEGER', 'DECIMAL', 'FRACTION', 'NUMBER_WITH_UNIT'];
/** Accepted answers and choice options per part (answer-checking, content-authoring "Field limits"). */
const MAX_ITEMS = 10;
const MIN_OPTIONS = 2;

/** An error for a group of controls (a list), with the path marker the form alert looks for. */
export function GroupError({ path, errors }: { path: string; errors: Record<string, string> }) {
  const error = errors[path];
  return (
    <div data-field={path}>
      {error && (
        <p className="admin-error" role="alert" data-content>
          {error}
        </p>
      )}
    </div>
  );
}

/** A checkbox flag of a spec type, labelled. */
function Flag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="admin-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/**
 * One answer part (FR-6): its type, the accepted answers (with the server's normalized reading
 * after a save) or the lettered options, the flags of its type, and its label. The type comes first,
 * then the answer, so the keyboard path of a typical task is short (NFR-8). Paths follow the
 * contract: `parts[i].spec.accepted[j]`.
 */
export function PartEditor({
  part,
  index,
  count,
  errors,
  onChange,
  onMove,
  onRemove,
  onRemoveOption,
}: {
  part: PartForm;
  index: number;
  count: number;
  errors: Record<string, string>;
  onChange: (part: PartForm) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  /** Removes option j and moves its translations with the letters (see `removeOption`). */
  onRemoveOption: (j: number) => void;
}) {
  const t = useT();
  const n = index + 1;
  const path = `parts[${index}]`;
  const set = (patch: Partial<PartForm>) => onChange({ ...part, ...patch });
  const choice = CHOICE_TYPES.includes(part.type);

  const setAccepted = (j: number, value: string) => {
    const normalized = [...part.normalized];
    normalized[j] = '';
    set({ accepted: part.accepted.map((v, k) => (k === j ? value : v)), normalized });
  };

  return (
    <fieldset className="admin-fieldset">
      <legend className="admin-legend">{format(t('admin.editor.part'), { n })}</legend>
      <Field label={t('admin.editor.partType')} path={`${path}.spec.type`} errors={errors}>
        {(p) => (
          <select {...p} data-content={undefined} className="admin-field" value={part.type} onChange={(e) => set({ type: e.target.value as AnswerType })}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`admin.type.${type}` as MessageKey)}
              </option>
            ))}
          </select>
        )}
      </Field>

      {choice ? (
        <fieldset className="admin-fieldset">
          <legend className="admin-legend">{t('admin.editor.options')}</legend>
          {part.options.map((option, j) => {
            const key = optionKey(j);
            return (
              <div key={j} className="admin-row">
                <Field label={format(t('admin.editor.option'), { key })} path={`${path}.spec.options[${j}].text`} errors={errors}>
                  {(p) => (
                    <input
                      {...p}
                      className="admin-field"
                      value={option.text}
                      onChange={(e) => set({ options: part.options.map((o, k) => (k === j ? { ...o, text: e.target.value } : o)) })}
                    />
                  )}
                </Field>
                <Flag
                  label={format(t('admin.editor.optionCorrect'), { key })}
                  checked={option.correct}
                  onChange={(correct) => set({ options: part.options.map((o, k) => (k === j ? { ...o, correct } : o)) })}
                />
                {part.options.length > MIN_OPTIONS && (
                  <Button onClick={() => onRemoveOption(j)}>
                    {format(t('admin.editor.removeOption'), { key })}
                  </Button>
                )}
              </div>
            );
          })}
          <GroupError path={`${path}.spec.options`} errors={errors} />
          <div>
            <Button
              disabled={part.options.length >= MAX_ITEMS}
              onClick={() => set({ options: [...part.options, { text: '', correct: false }] })}
            >
              {t('admin.editor.addOption')}
            </Button>
          </div>
        </fieldset>
      ) : (
        part.accepted.map((value, j) => (
          <div key={j} className="admin-row">
            <Field
              label={format(t('admin.editor.accepted'), { n: j + 1 })}
              path={`${path}.spec.accepted[${j}]`}
              errors={errors}
            >
              {(p) => <input {...p} className="admin-field" autoComplete="off" value={value} onChange={(e) => setAccepted(j, e.target.value)} />}
            </Field>
            {part.normalized[j] && (
              <span className="admin-muted">
                {t('admin.editor.normalized')} <span data-content>{part.normalized[j]}</span>
              </span>
            )}
            {part.accepted.length > 1 && (
              <Button
                onClick={() => set({ accepted: part.accepted.filter((_, k) => k !== j), normalized: part.normalized.filter((_, k) => k !== j) })}
              >
                {format(t('admin.editor.removeAccepted'), { n: j + 1 })}
              </Button>
            )}
          </div>
        ))
      )}
      <GroupError path={`${path}.spec.accepted`} errors={errors} />
      {!choice && (
        <div>
          <Button disabled={part.accepted.length >= MAX_ITEMS} onClick={() => set({ accepted: [...part.accepted, ''] })}>
            {t('admin.editor.addAccepted')}
          </Button>
        </div>
      )}

      <div className="admin-row">
        {NUMERIC.includes(part.type) && (
          <Field label={t('admin.editor.tolerance')} path={`${path}.spec.tolerance`} errors={errors}>
            {(p) => <input {...p} className="admin-field" value={part.tolerance} onChange={(e) => set({ tolerance: e.target.value })} />}
          </Field>
        )}
        {part.type === 'DECIMAL' && (
          <Field label={t('admin.editor.exactDecimals')} path={`${path}.spec.exactDecimals`} errors={errors}>
            {(p) => (
              <input {...p} className="admin-field" inputMode="numeric" value={part.exactDecimals} onChange={(e) => set({ exactDecimals: e.target.value })} />
            )}
          </Field>
        )}
      </div>
      {part.type === 'FRACTION' && (
        <div className="admin-actions">
          <Flag label={t('admin.editor.allowEquivalent')} checked={part.allowEquivalent} onChange={(v) => set({ allowEquivalent: v })} />
          <Flag label={t('admin.editor.lowestTerms')} checked={part.requireLowestTerms} onChange={(v) => set({ requireLowestTerms: v })} />
        </div>
      )}
      {part.type === 'NUMBER_WITH_UNIT' && (
        <Flag label={t('admin.editor.unitRequired')} checked={part.unitRequired} onChange={(v) => set({ unitRequired: v })} />
      )}
      {part.type === 'TEXT' && (
        <Flag label={t('admin.editor.diacriticsStrict')} checked={part.diacriticsStrict} onChange={(v) => set({ diacriticsStrict: v })} />
      )}

      <Field label={t('admin.editor.partLabel')} path={`${path}.label`} errors={errors}>
        {(p) => <input {...p} className="admin-field" value={part.label} onChange={(e) => set({ label: e.target.value })} />}
      </Field>
      <GroupError path={path} errors={errors} />
      <div className="admin-actions">
        <Button disabled={index === 0} onClick={() => onMove(-1)}>
          {format(t('admin.editor.movePartUp'), { n })}
        </Button>
        <Button disabled={index === count - 1} onClick={() => onMove(1)}>
          {format(t('admin.editor.movePartDown'), { n })}
        </Button>
        <Button onClick={onRemove}>
          {format(t('admin.editor.removePart'), { n })}
        </Button>
      </div>
    </fieldset>
  );
}
