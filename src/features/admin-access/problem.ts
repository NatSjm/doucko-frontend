import type { components } from '@/api/generated/schema';

export type Problem = components['schemas']['Problem'];

/** An admin API refusal: the HTTP status and, when the body was problem+json, the problem. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem | null;

  constructor(status: number, problem: Problem | null) {
    super(problem?.title ?? `HTTP ${status}`);
    this.status = status;
    this.problem = problem;
  }
}

const isProblem = (value: unknown): value is Problem => typeof value === 'object' && value !== null && 'title' in value;

/** The data of an openapi-fetch result, or an [ApiError] for any non-2xx answer. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok) throw new ApiError(result.response.status, isProblem(result.error) ? result.error : null);
  return result.data as T;
}

/** `errors[].field` → first message, from an [ApiError] (contract "Field paths"); else empty. */
export function fieldErrors(error: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!(error instanceof ApiError)) return out;
  for (const { field, message } of error.problem?.errors ?? []) out[field] ??= message;
  return out;
}

/** The problem's `detail`, else its `title`; null when there is no problem (network error, no body). */
export function problemMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.problem) return null;
  return error.problem.detail ?? error.problem.title;
}
