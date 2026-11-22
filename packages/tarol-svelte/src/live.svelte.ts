import type { PushClient, PushedMessage, Topic } from '@clorat/tarol-client/push';
import { getTarol } from './context.js';

/** The reactive state of a push subscription. */
export interface Live<T> {
  /** The latest message on the topic, or `undefined` before the first one. */
  readonly message: PushedMessage<T> | undefined;
  /** How many messages arrived since the component was created. */
  readonly count: number;
}

/**
 * Subscribes to a push topic for the component's lifetime: one rune. `topic` may read `$state`; a change moves the
 * subscription. A generated `topics.<name>` types the message (`PushedMessage<BidPlacedV1>`). Needs a push connection in
 * {@link setTarol} (or `push`).
 */
export function live<T = unknown>(topic: () => string | Topic<T> | null, push?: PushClient): Live<T> {
  const p = push ?? getTarol().push;
  if (!p) throw new Error('tarol-svelte: live() needs a push connection: setTarol(client, connectPush(...))');
  let message = $state.raw<PushedMessage<T> | undefined>();
  let count = $state(0);
  $effect(() => {
    const given = topic();
    if (given === null) return;
    const t = typeof given === 'string' ? given : given.topic;
    return p.subscribe<T>(t, (m) => {
      message = m;
      count++;
    });
  });
  return {
    get message() {
      return message;
    },
    get count() {
      return count;
    },
  };
}
