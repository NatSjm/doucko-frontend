// @trace NFR-7
// @trace NFR-5
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Link } from './Link';
import { hasNavigated, navigate, useNavigationCount } from './navigation';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

/** Shows the navigation count and a per-mount id, so a remount is visible. */
function Probe() {
  const count = useNavigationCount();
  const [mount] = useState(() => Math.random());
  return (
    <div>
      <span data-testid="count">{count}</span>
      <span key={count} data-testid="path">
        {window.location.pathname + window.location.search}
      </span>
      <span data-testid="mount">{mount}</span>
    </div>
  );
}

describe('client-side navigation (NFR-5, NFR-7)', () => {
  it('navigate() changes the URL without a page load and tells subscribers', () => {
    render(<Probe />);
    const before = Number(screen.getByTestId('count').textContent);
    act(() => navigate('/mission?missionId=m1'));
    expect(window.location.pathname + window.location.search).toBe('/mission?missionId=m1');
    expect(Number(screen.getByTestId('count').textContent)).toBe(before + 1);
    expect(screen.getByTestId('path')).toHaveTextContent('/mission?missionId=m1');
    expect(hasNavigated()).toBe(true);
  });

  it('back and forward (popstate) count as navigations', () => {
    render(<Probe />);
    const before = Number(screen.getByTestId('count').textContent);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(Number(screen.getByTestId('count').textContent)).toBe(before + 1);
  });

  it('a replaceState of the query is not a navigation', () => {
    render(<Probe />);
    const before = screen.getByTestId('count').textContent;
    act(() => window.history.replaceState({}, '', '/task?missionId=m1&taskId=t1'));
    expect(screen.getByTestId('count').textContent).toBe(before);
  });

  it('Link opens its href in the app on a plain click', async () => {
    render(
      <>
        <Link href="/task?missionId=m2">go</Link>
        <Probe />
      </>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'go' }));
    expect(window.location.pathname + window.location.search).toBe('/task?missionId=m2');
  });

  it('Link leaves modified clicks and prevented clicks to the browser', () => {
    let calls = 0;
    render(
      <>
        <Link href="/task?missionId=m3">new tab</Link>
        <Link href="/task?missionId=m4" onClick={(e) => { calls += 1; e.preventDefault(); }}>
          handled
        </Link>
      </>,
    );
    window.history.pushState({}, '', '/');
    const ctrl = fireEvent.click(screen.getByRole('link', { name: 'new tab' }), { ctrlKey: true });
    expect(ctrl).toBe(true);
    expect(window.location.pathname).toBe('/');
    fireEvent.click(screen.getByRole('link', { name: 'handled' }));
    expect(calls).toBe(1);
    expect(window.location.pathname).toBe('/');
  });
});
