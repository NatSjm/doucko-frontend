// @trace NFR-9
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '@/i18n';
import { FormAlert } from './form';

/** A parent that rebuilds its errors object on every render, as the task list filters do. */
function Parent() {
  const [note, setNote] = useState('');
  const errors = { page: 'Page must be a whole number' };
  return (
    <form>
      <input data-field="page" aria-label="page" aria-invalid="true" defaultValue="x" />
      <input aria-label="note" value={note} onChange={(e) => setNote(e.target.value)} />
      <FormAlert errors={errors} failure={null} />
    </form>
  );
}

describe('FormAlert', () => {
  it('does not take the focus back on a re-render with the same errors', async () => {
    render(
      <I18nProvider>
        <Parent />
      </I18nProvider>,
    );
    expect(screen.getByLabelText('page')).toHaveFocus();
    await userEvent.click(screen.getByLabelText('note'));
    await userEvent.keyboard('ab');
    expect(screen.getByLabelText('note')).toHaveFocus();
    expect(screen.getByLabelText('note')).toHaveValue('ab');
  });
});
