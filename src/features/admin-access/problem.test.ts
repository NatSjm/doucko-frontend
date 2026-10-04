// Store spec content-authoring: refusals are shown inline on the field the problem names
// (`errors[].field`, contract "Field paths"). Shared admin plumbing, so no FR is traced here.
import { describe, expect, it } from 'vitest';
import { ApiError, fieldErrors, problemConflicts, problemMessage, unwrap } from './problem';

const response = (status: number) => new Response(null, { status });

describe('unwrap', () => {
  it('returns the data of a successful answer', () => {
    expect(unwrap({ data: { a: 1 }, response: response(200) })).toEqual({ a: 1 });
  });

  it('returns undefined data of a 204', () => {
    expect(unwrap({ data: undefined, response: response(204) })).toBeUndefined();
  });

  it('throws an ApiError with status and problem on a refusal', () => {
    const problem = { type: 'about:blank', title: 'Invalid input', status: 400, errors: [{ field: 'title', message: 'Title is required.' }] };
    const thrown = (() => {
      try {
        unwrap({ error: problem, response: response(400) });
      } catch (e) {
        return e;
      }
    })();
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).status).toBe(400);
    expect((thrown as ApiError).problem).toEqual(problem);
  });

  it('keeps a refusal without a problem body as a problem-less ApiError', () => {
    expect(() => unwrap({ error: 'oops', response: response(502) })).toThrow(ApiError);
    try {
      unwrap({ error: 'oops', response: response(502) });
    } catch (e) {
      expect((e as ApiError).problem).toBeNull();
    }
  });
});

describe('fieldErrors', () => {
  it('maps each field path to its first message', () => {
    const error = new ApiError(400, {
      type: 'about:blank',
      title: 'Invalid input',
      status: 400,
      errors: [
        { field: 'parts[0].spec.accepted[0]', message: 'This value cannot be read.' },
        { field: 'prompt', message: 'Prompt is required.' },
        { field: 'prompt', message: 'second message' },
      ],
    });
    expect(fieldErrors(error)).toEqual({ 'parts[0].spec.accepted[0]': 'This value cannot be read.', prompt: 'Prompt is required.' });
  });

  it('is empty for anything that is not an ApiError with field errors', () => {
    expect(fieldErrors(new Error('x'))).toEqual({});
    expect(fieldErrors(new ApiError(500, null))).toEqual({});
    expect(fieldErrors(new ApiError(409, { type: 'about:blank', title: 'Conflict', status: 409 }))).toEqual({});
  });
});

describe('problemMessage', () => {
  it('prefers the detail, then the title', () => {
    expect(problemMessage(new ApiError(415, { type: 'about:blank', title: 'Unsupported', status: 415, detail: 'Only PDF files up to 50 MB are allowed.' }))).toBe(
      'Only PDF files up to 50 MB are allowed.',
    );
    expect(problemMessage(new ApiError(409, { type: 'about:blank', title: 'Conflict', status: 409 }))).toBe('Conflict');
  });

  it('is null without a problem', () => {
    expect(problemMessage(new ApiError(500, null))).toBeNull();
    expect(problemMessage(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe('problemConflicts', () => {
  it('lists the blocking ids of a 409 refusal (Mission publishing rules, Delete only unused content)', () => {
    const error = new ApiError(409, { type: 'about:blank', title: 'Not allowed now', status: 409, detail: 'x', conflicts: ['a', 'b'] });
    expect(problemConflicts(error)).toEqual(['a', 'b']);
  });

  it('is empty without conflicts, without a problem, or for another error', () => {
    expect(problemConflicts(new ApiError(409, { type: 'about:blank', title: 'Not allowed now', status: 409 }))).toEqual([]);
    expect(problemConflicts(new ApiError(500, null))).toEqual([]);
    expect(problemConflicts(new TypeError('Failed to fetch'))).toEqual([]);
  });
});
