import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { messages } from '@/i18n';
import { App } from './App';

afterEach(() => {
  window.history.pushState({}, '', '/');
  document.title = '';
});

describe('App shell', () => {
  it('renders the product name as the page heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Doučko' })).toBeInTheDocument();
  });

  it('renders the route registered for the current path and marks it', () => {
    const { container } = render(<App />);
    expect(container.querySelector('[data-route="/"]')).not.toBeNull();
  });

  it('renders the not-found screen for an unregistered path, not the first route', () => {
    window.history.pushState({}, '', '/no-such-route');
    const { container } = render(<App />);
    expect(messages['app.notFound']).toBeTruthy();
    expect(container.querySelector('[data-route="not-found"]')).not.toBeNull();
    expect(container.querySelector('[data-route="/"]')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: messages['app.name'] })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: messages['app.notFound'] })).toBeInTheDocument();
  });

  it('sets the document title from the catalog', () => {
    render(<App />);
    expect(document.title).toBe(messages['app.name']);
  });
});
