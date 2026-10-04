import { useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { useT } from '@/i18n';

/** The props a field control gets from [Field]: its id, its error wiring and its problem path. */
export interface ControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  'data-field': string;
  /** The value is content the admin typed (the `⟦` render test, NFR-9); a select overrides it with undefined. */
  'data-content': true | undefined;
}

/**
 * A labelled control with its inline error. `path` is the problem field path the control shows
 * (contract "Field paths", e.g. `parts[0].spec.accepted[1]`), so a refusal lands under it.
 */
export function Field({
  label,
  path,
  errors,
  hint,
  children,
}: {
  label: string;
  path: string;
  errors: Record<string, string>;
  hint?: string;
  children: (props: ControlProps) => ReactElement;
}) {
  const id = useId();
  const error = errors[path];
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="admin-control">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'data-field': path, 'data-content': true })}
      {error && (
        <p id={errorId} className="admin-error" data-content>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="admin-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * After a refusal: focuses the first invalid control of the enclosing form, and lists in an alert the errors
 * whose path no control shows (and `failure`, a message for a refusal without field errors). Which
 * paths have a control is read from the form's `data-field` markers once it is laid out.
 */
export function FormAlert({ errors, failure }: { errors: Record<string, string>; failure: string | null }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  useLayoutEffect(() => {
    // The enclosing form: its own ref is not attached yet while its children lay out.
    const root = (box.current as HTMLDivElement).closest('form') as HTMLFormElement;
    const shown = new Set([...root.querySelectorAll('[data-field]')].map((el) => el.getAttribute('data-field')));
    // Which paths have a control is known only once the form is laid out (a measurement).
    setUnmatched(Object.keys(errors).filter((path) => !shown.has(path)));
    root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const visible = unmatched.filter((path) => path in errors);
  return (
    <div ref={box}>
      {(failure || visible.length > 0) && (
        <div role="alert" className="admin-alert">
          {failure && <p data-content>{failure}</p>}
          {visible.length > 0 && (
            <>
              <p>{t('admin.common.formErrors')}</p>
              <ul data-content>
                {visible.map((path) => (
                  <li key={path}>{errors[path]}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
