import { useEffect, useRef, type ReactNode } from 'react';
import { hasNavigated } from '@/app/navigation';
import { Link } from '@/app/Link';
import { Button, Icon } from '@/design-system';
import { useT } from '@/i18n';
import './child.css';

/**
 * The frame of every child screen (Czech, no login): the "Doučko" brand linking to HQ, and the
 * screen's `<main>` with its single heading. After an in-app navigation the heading takes focus so a
 * keyboard or screen-reader user starts on the new screen, unless the screen focuses something itself.
 */
export function ChildLayout({ title, kicker, aside, focusHeading = true, wide = false, children }: {
  title: ReactNode;
  kicker?: ReactNode;
  aside?: ReactNode;
  focusHeading?: boolean;
  wide?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading && hasNavigated()) heading.current?.focus();
  }, [focusHeading]);
  return (
    <div className="child-page">
      <header className="child-top">
        <Link className="child-brand dk-t-heading" href="/">
          {t('app.name')}
        </Link>
      </header>
      <main className={wide ? 'child-main child-main-wide' : 'child-main'}>
        <div className="child-head">
          <div>
            {kicker && <p className="dk-kicker">{kicker}</p>}
            <h1 ref={heading} tabIndex={-1} className="dk-t-title child-title">
              {title}
            </h1>
          </div>
          {aside}
        </div>
        {children}
      </main>
    </div>
  );
}

/** A link back to HQ, styled as a quiet text button. */
export function BackToHq() {
  const t = useT();
  return (
    <Link className="dk-link child-back" href="/">
      <Icon name="arrow" size={16} className="child-back-icon" />
      {t('child.common.backToHq')}
    </Link>
  );
}

/** A status line while a screen loads, and an alert with a retry when it could not. */
export function ChildLoadState({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  const t = useT();
  if (!error) return <p role="status">{t('child.common.loading')}</p>;
  return (
    <div className="child-stack">
      <p role="alert">{t('child.common.loadFailed')}</p>
      <div>
        <Button onClick={onRetry}>{t('child.common.retry')}</Button>
      </div>
    </div>
  );
}

/** A friendly dead end ("Tuhle misi jsem nenašel.") with the way back to HQ. */
export function ChildDeadEnd({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="child-stack">
      <p role="alert" className="child-dead-end">
        {message}
      </p>
      <div>
        <Link className="dk-btn dk-btn-primary" href="/">
          {t('child.common.backToHq')}
        </Link>
      </div>
    </div>
  );
}
