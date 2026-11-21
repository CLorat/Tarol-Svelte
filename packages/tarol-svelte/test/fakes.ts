import type { ChangeEvent, ChangeOptions, ChangeRequest, ReadOptions, Result, TarolClient } from '@clorat/tarol-client';
import type { PushClient, PushedMessage } from '@clorat/tarol-client/push';
import { vi } from 'vitest';

export interface ReadCall {
  path: string;
  options: ReadOptions | undefined;
}

/** A TarolClient double: reads are answered by `answer`, changes by `changeAnswer`; every call is recorded. */
export function fakeClient(answer: (path: string, o?: ReadOptions) => Result<unknown> | Promise<Result<unknown>>) {
  const reads: ReadCall[] = [];
  const changes: { request: ChangeRequest; options: ChangeOptions | undefined }[] = [];
  const listeners = new Set<(e: ChangeEvent) => void>();
  let changeAnswer: (r: ChangeRequest) => Result<unknown> = () => okResult(undefined);
  const client: TarolClient = {
    read: <T>(path: string, options?: ReadOptions) => {
      reads.push({ path, options });
      return Promise.resolve(answer(path, options)) as Promise<Result<T>>;
    },
    change: <T>(request: ChangeRequest, options?: ChangeOptions) => {
      changes.push({ request, options });
      const r = changeAnswer(request);
      if (r.ok) for (const l of listeners) l({ method: request.method, path: request.path });
      return Promise.resolve(r as Result<T>);
    },
    url: (p) => p,
    invalidate: vi.fn(),
    onChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    position: null,
  };
  return {
    client,
    reads,
    changes,
    answerChanges(f: (r: ChangeRequest) => Result<unknown>) {
      changeAnswer = f;
    },
  };
}

export function okResult<T>(value: T, extra: Partial<{ version: number; stale: boolean }> = {}): Result<T> {
  return { ok: true, value, status: 200, replayed: false, stale: false, notModified: false, ...extra };
}

/** A PushClient double that the test drives. */
export function fakePush() {
  const handlers = new Map<string, Set<(m: PushedMessage) => void>>();
  const reconnects = new Set<() => void>();
  const push: PushClient = {
    subscribe: <T>(topic: string, h: (m: PushedMessage<T>) => void) => {
      const set = handlers.get(topic) ?? new Set();
      handlers.set(topic, set);
      set.add(h as (m: PushedMessage) => void);
      return () => set.delete(h as (m: PushedMessage) => void);
    },
    publish: () => Promise.resolve(null),
    onReconnect: (l) => {
      reconnects.add(l);
      return () => reconnects.delete(l);
    },
    onState: () => () => undefined,
    state: 'connected',
    close: () => undefined,
  };
  return {
    push,
    handlers,
    emit(topic: string, data: unknown, subject: string | null = null) {
      for (const h of handlers.get(topic) ?? [])
        h({ topic, id: '1', version: 1, subject, time: '', sender: 's', data });
    },
    reconnect() {
      for (const l of reconnects) l();
    },
  };
}
