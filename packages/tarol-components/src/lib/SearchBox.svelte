<!--
  @component
  The global search box over the backend's `MapTarolSearch` entry (`GET /search?q=…`): a `Combobox` that asks the server
  as the user types (debounced, the previous request aborted) and lists the hits by title. Choosing a hit calls `onselect`
  with it, e.g. to navigate to its aggregate. Hits are shown as plain text; the server's highlighted snippets are not
  requested (they are HTML, BC-8), so no server text is ever rendered as markup.
-->
<script module lang="ts">
  /** A search hit as `MapTarolSearch` answers it (without the snippet, see the component's notes). */
  export interface SearchHit {
    /** The searchable type, e.g. `Auction`. */
    readonly type: string;
    /** The document's id. */
    readonly id: string;
    /** The aggregate the hit is shown through (the page to open). */
    readonly aggregate: string;
    /** The document's title, plain text. */
    readonly title: string;
    /** The relevance score. */
    readonly score: number;
  }
</script>

<script lang="ts">
  import type { Violation } from '@clorat/tarol-client';
  import { Combobox, getMessages } from '@clorat/tarol-design';
  import { getTarol } from '@clorat/tarol-svelte';

  interface Props {
    /** The visible label (the app's own text). */
    label: string;
    /** Called with the chosen hit. */
    onselect: (hit: SearchHit) => void;
    /** The search entry's path. Default `/search`. */
    path?: string | undefined;
    /** Only these searchable types (the `types` parameter). Default: every type the user may read. */
    types?: readonly string[] | undefined;
    /** Hits per request (the backend allows at most 50). Default 8. */
    limit?: number | undefined;
    /** Characters before the first request. Default 2. */
    minLength?: number | undefined;
    /** Milliseconds to wait after the last keystroke. Default 150. */
    debounce?: number | undefined;
    /** Shows a type's name next to a hit's title, e.g. `(type) => t('type.' + type)`. Default: the title only. */
    describe?: ((hit: SearchHit) => string) | undefined;
    /** The input's placeholder (already translated). */
    placeholder?: string | undefined;
  }

  let {
    label,
    onselect,
    path = '/search',
    types,
    limit = 8,
    minLength = 2,
    debounce = 150,
    describe,
    placeholder,
  }: Props = $props();
  const t = getMessages();
  const { client } = getTarol();
  let hits = $state.raw<readonly SearchHit[]>([]);
  let loading = $state(false);
  let violation = $state<Violation | undefined>();
  let value = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: AbortController | undefined;

  const key = (h: SearchHit): string => `${h.type}:${h.id}`;
  const options = $derived(hits.map((h) => ({ value: key(h), label: describe ? describe(h) : h.title })));

  function search(text: string): void {
    clearTimeout(timer);
    running?.abort();
    const q = text.trim();
    if (q.length < minLength) {
      hits = [];
      loading = false;
      return;
    }
    loading = true;
    timer = setTimeout(() => {
      const controller = (running = new AbortController());
      const query = { q, limit, ...(types ? { types: types.join(',') } : {}) };
      client
        .read<{ items: SearchHit[] }>(path, { query, signal: controller.signal })
        .then((r) => {
          if (controller.signal.aborted) return;
          hits = r.ok ? r.value.items : [];
          violation = r.ok ? undefined : r.violation;
          loading = false;
        })
        .catch(() => undefined); // aborted by the next keystroke
    }, debounce);
  }

  $effect(() => () => {
    clearTimeout(timer);
    running?.abort();
  });
</script>

<Combobox
  {label}
  {options}
  {loading}
  {placeholder}
  filter={false}
  bind:value
  error={violation ? t(violation.kind === 'error' ? violation.code : 'error.generic') : undefined}
  onquery={search}
  onchange={(v) => {
    const hit = hits.find((h) => key(h) === v);
    if (hit) onselect(hit);
  }}
/>
