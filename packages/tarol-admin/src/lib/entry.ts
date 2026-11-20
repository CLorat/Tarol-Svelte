import type { ChangeRequest, Failed } from '@clorat/tarol-client';
import type { Translate } from '@clorat/tarol-design';
import type { ReadRequest } from './api.js';

/** A generated request below the admin entry's prefix (the document's paths are relative to it). */
export function under<R extends ReadRequest | ChangeRequest>(prefix: string, request: R): R {
  return { ...request, path: prefix.replace(/\/+$/, '') + request.path };
}

/** A refusal as one line: the code's message and, when the backend gave one, the reference to quote. */
export function refusal(t: Translate, failed: Failed): string {
  const v = failed.violation;
  const text = t(v.kind === 'error' ? v.code : (Object.values(v.errors)[0]?.[0] ?? 'error.generic'));
  return failed.requestId ? `${text} ${t('ui.reference', { id: failed.requestId })}` : text;
}
