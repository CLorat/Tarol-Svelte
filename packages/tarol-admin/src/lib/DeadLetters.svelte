<!--
  @component
  The dead letters of one kind (the backend lists the kinds it has: `GET {prefix}/dead`), keyset-paged, with re-drive and
  discard per row and "re-drive all", each after a confirmation.
-->
<script lang="ts">
  import { getTarol, list, query } from '@clorat/tarol-svelte';
  import { DataTable, QueryState, type Column } from '@clorat/tarol-components';
  import { Button, Dialog, getMessages, getToasts, MenuButton } from '@clorat/tarol-design';
  import type { ChangeRequest, Result } from '@clorat/tarol-client';
  import { requests, type DeadLetterView, type RedriveView } from './api.js';
  import { refusal, under } from './entry.js';

  interface Props {
    /** Where the backend mapped the admin entry. */
    prefix: string;
  }

  let { prefix }: Props = $props();
  const { client } = getTarol();
  const t = getMessages();
  const toasts = getToasts();
  const kinds = query<string[]>(() => under(prefix, requests.tarolAdminKinds()));
  let chosen = $state<string>();
  const kind = $derived(chosen ?? kinds.value?.[0]);
  const letters = list<DeadLetterView>(() =>
    kind ? under(prefix, requests.tarolAdminDeadLetters({ kind }, { limit: 50 })) : null,
  );
  // one state for the table: loading until the kinds and the first page are there (no empty text in between)
  const table: typeof letters = Object.create(letters, {
    loading: { get: () => letters.loading || (kind === undefined && kinds.violation === undefined) },
  }) as typeof letters;
  const columns: Column[] = [
    { key: 'id', header: t('admin.id'), align: 'end' },
    { key: 'name', header: t('admin.name') },
    { key: 'subject', header: t('admin.subjectColumn') },
    { key: 'attempts', header: t('admin.attempts'), align: 'end' },
    { key: 'error', header: t('admin.error') },
    { key: 'deadAt', header: t('admin.deadAt') },
    { key: 'actions', header: t('admin.actions') },
  ];
  // the action waiting for its confirmation
  let pending = $state<{ question: string; request: ChangeRequest; done: (r: unknown) => string }>();

  function ask(action: string, row: DeadLetterView | undefined): void {
    if (!kind) return;
    if (!row)
      pending = {
        question: t('admin.confirmRedriveAll'),
        request: requests.tarolAdminRedriveMany({ kind }),
        done: (r) => t('admin.redriven', { count: (r as RedriveView).redriven }),
      };
    else if (action === 'redrive')
      pending = {
        question: t('admin.confirmRedrive', { id: row.id }),
        request: requests.tarolAdminRedrive({ kind, id: row.id }),
        done: () => t('admin.redriven', { count: 1 }),
      };
    else
      pending = {
        question: t('admin.confirmDiscard', { id: row.id }),
        request: requests.tarolAdminDiscard({ kind, id: row.id }),
        done: () => t('admin.discarded'),
      };
  }

  async function confirm(): Promise<void> {
    const p = pending;
    pending = undefined;
    if (!p) return;
    const r: Result<unknown> = await client.change(under(prefix, p.request));
    if (r.ok) toasts.show(p.done(r.value), { kind: 'success' });
    else toasts.show(refusal(t, r), { kind: 'error' });
    await letters.refresh();
  }
</script>

{#if kinds.violation}<QueryState state={kinds}>{null}</QueryState>{:else}
  <div class="t-admin-bar">
    <label>
      {t('admin.kind')}
      <select
        value={kind}
        onchange={(e) => {
          chosen = e.currentTarget.value;
        }}
      >
        {#each kinds.value ?? [] as k (k)}<option value={k}>{k}</option>{/each}
      </select>
    </label>
    <Button
      variant="secondary"
      disabled={letters.items.length === 0}
      onclick={() => {
        ask('redrive', undefined);
      }}
    >
      {t('admin.redriveAll')}
    </Button>
  </div>
  <div class="t-admin-letters">
    <QueryState state={table}>
      <DataTable list={letters} {columns} caption={t('admin.deadLetters')} rowKey={(r: DeadLetterView) => String(r.id)}>
        {#snippet cell(row: DeadLetterView, c: Column)}
          {#if c.key === 'actions'}
            <MenuButton
              variant="ghost"
              items={[
                { id: 'redrive', label: t('admin.redrive') },
                { id: 'discard', label: t('admin.discard') },
              ]}
              onselect={(a) => {
                ask(a, row);
              }}
            >
              {t('admin.actions')}
              {row.id}
            </MenuButton>
          {:else}{String(row[c.key as keyof DeadLetterView] ?? '')}{/if}
        {/snippet}
      </DataTable>
    </QueryState>
  </div>
{/if}

<Dialog open={pending !== undefined} title={t('admin.deadLetters')} onclose={() => (pending = undefined)}>
  <p>{pending?.question}</p>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (pending = undefined)}>{t('admin.cancel')}</Button>
    <Button variant="danger" onclick={() => void confirm()}>{t('admin.confirm')}</Button>
  {/snippet}
</Dialog>

<style>
  .t-admin-bar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--t-space-4);
    margin-block-end: var(--t-space-4);
  }
  /* the height of QueryState's three skeleton rows: a short page replacing them moves nothing below (CLS) */
  .t-admin-letters {
    min-block-size: calc(3 * 2.5rem + 2 * var(--t-space-2));
  }
</style>
