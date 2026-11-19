import type { TarolClient } from '@clorat/tarol-client';
import type { PushClient } from '@clorat/tarol-client/push';
import { getContext, setContext } from 'svelte';

const key = Symbol('tarol');

/** What the bindings take from the component tree: the client, and the push connection if the app has one. */
export interface Tarol {
  /** The client every query, list and form uses. */
  readonly client: TarolClient;
  /** The UI push connection, for `live` topics and `query(…, { live })`. */
  readonly push?: PushClient;
}

/** Puts the client (and optionally the push connection) into the component context; call it in the root component. */
export function setTarol(client: TarolClient, push?: PushClient): Tarol {
  return setContext(key, push ? { client, push } : { client });
}

/** The client of the nearest {@link setTarol}; throws when there is none (a setup error, not a business outcome). */
export function getTarol(): Tarol {
  const t = getContext<Tarol | undefined>(key);
  if (!t) throw new Error('tarol-svelte: call setTarol(client) in a parent component first');
  return t;
}
