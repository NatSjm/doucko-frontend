import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './navigation';

/**
 * A plain `<a href>` that opens same-app screens without a page load. Modified or non-primary
 * clicks (new tab, new window) keep the browser's behaviour.
 */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
  return <a href={href} onClick={handleClick} {...rest} />;
}
