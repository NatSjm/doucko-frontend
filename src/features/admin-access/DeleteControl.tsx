import { useEffect, useRef, useState } from 'react';
import { Button } from '@/design-system';
import { useT } from '@/i18n';

/**
 * A delete button that asks first (FR-56 deletes cannot be undone): the question with Delete and
 * Cancel, focus on Cancel, Escape cancels. After the question closes, focus returns to the button.
 * `onConfirm` reports its own outcome (a refusal is shown by the screen).
 */
export function DeleteControl({
  label,
  question,
  disabled = false,
  onConfirm,
}: {
  label: string;
  question: string;
  disabled?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const returnFocus = useRef(false);

  useEffect(() => {
    const target = asking ? '[data-cancel]' : returnFocus.current ? '[data-start]' : null;
    if (target) box.current?.querySelector<HTMLElement>(target)?.focus();
    returnFocus.current = false;
  }, [asking]);

  const close = () => {
    returnFocus.current = true;
    setAsking(false);
  };

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      close();
    }
  }

  return (
    <div ref={box}>
      {asking ? (
        <div
          className="admin-confirm"
          role="group"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <p>{question}</p>
          <div className="admin-actions">
            <Button disabled={busy} onClick={() => void confirm()}>
              {t('admin.common.delete')}
            </Button>
            <Button data-cancel disabled={busy} onClick={close}>
              {t('admin.common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button data-start disabled={disabled} onClick={() => setAsking(true)}>
          {label}
        </Button>
      )}
    </div>
  );
}
