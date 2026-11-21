<!--
  @component
  A data subject's personal data (Tarol.DataProtection): export it as a JSON download, or erase it after typing the
  subject's id. An erasure that did not finish everywhere (409 `DataProtection.ErasureIncomplete`) names the participants
  and can be repeated; the backend keeps the erasure idempotent.
-->
<script lang="ts">
  import { getTarol } from '@clorat/tarol-svelte';
  import { Button, Dialog, getMessages, TextField } from '@clorat/tarol-design';
  import { untrack } from 'svelte';
  import { requests, type ErasureView } from './api.js';
  import { refusal, under } from './entry.js';

  interface Props {
    /** Where the backend mapped the admin entry. */
    prefix: string;
    /** The tenant to start with. Default the empty GUID (data without a tenant). */
    tenant?: string | undefined;
  }

  let { prefix, tenant: initial }: Props = $props();
  const { client } = getTarol();
  const t = getMessages();
  let subject = $state('');
  let tenant = $state(untrack(() => initial) ?? '00000000-0000-0000-0000-000000000000');
  let typed = $state('');
  let confirming = $state(false);
  let busy = $state(false);
  let download = $state<{ url: string; name: string; count: number }>();
  let outcome = $state<{ text: string; alert: boolean; retry?: boolean }>();

  $effect(() => () => {
    if (download) URL.revokeObjectURL(download.url);
  });

  async function exportData(): Promise<void> {
    busy = true;
    outcome = undefined;
    const req = under(prefix, requests.tarolAdminExportSubject({ id: subject.trim() }, { tenant: tenant.trim() }));
    const r = await client.read<{ events?: unknown[] }>(req.path, req.query ? { query: req.query } : {});
    busy = false;
    if (!r.ok) {
      outcome = { text: refusal(t, r), alert: true };
      return;
    }
    if (download) URL.revokeObjectURL(download.url);
    const blob = new Blob([JSON.stringify(r.value, null, 2)], { type: 'application/json' });
    download = {
      url: URL.createObjectURL(blob),
      name: `${subject.trim()}.json`,
      count: r.value.events?.length ?? 0,
    };
  }

  async function erase(): Promise<void> {
    confirming = false;
    typed = '';
    busy = true;
    outcome = undefined;
    const r = await client.change<ErasureView>(
      under(prefix, requests.tarolAdminEraseSubject({ id: subject.trim(), tenant: tenant.trim() })),
    );
    busy = false;
    if (r.ok) {
      outcome = {
        text: r.value.alreadyErased ? t('admin.alreadyErased') : t('admin.erased', { streams: r.value.streams }),
        alert: false,
      };
      return;
    }
    const failed = r.violation.kind === 'error' ? r.violation.extensions?.['failed'] : undefined;
    outcome = Array.isArray(failed)
      ? { text: `${refusal(t, r)} ${t('admin.incomplete', { failed: failed.join(', ') })}`, alert: true, retry: true }
      : { text: refusal(t, r), alert: true };
  }
</script>

<div class="t-admin-subject">
  <TextField label={t('admin.subjectId')} bind:value={subject} required />
  <TextField label={t('admin.tenant')} hint={t('admin.tenantHint')} bind:value={tenant} required />
  <div class="t-admin-actions">
    <Button variant="secondary" loading={busy} disabled={!subject.trim()} onclick={() => void exportData()}>
      {t('admin.export')}
    </Button>
    <Button variant="danger" disabled={busy || !subject.trim()} onclick={() => (confirming = true)}>
      {t('admin.erase')}
    </Button>
  </div>
  {#if download}<a href={download.url} download={download.name}>
      {t('admin.download', { count: download.count })}
    </a>{/if}
  {#if outcome}
    <p role={outcome.alert ? 'alert' : 'status'} class:t-admin-error={outcome.alert}>
      {outcome.text}
      {#if outcome.retry}<Button variant="secondary" onclick={() => void erase()}>{t('ui.retry')}</Button>{/if}
    </p>
  {/if}
</div>

<Dialog bind:open={confirming} title={t('admin.erase')} onclose={() => (typed = '')}>
  <TextField label={t('admin.confirmErase')} bind:value={typed} autocomplete="off" />
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (confirming = false)}>{t('admin.cancel')}</Button>
    <Button variant="danger" disabled={typed.trim() !== subject.trim()} onclick={() => void erase()}>
      {t('admin.erase')}
    </Button>
  {/snippet}
</Dialog>

<style>
  .t-admin-subject {
    display: grid;
    gap: var(--t-space-4);
    max-inline-size: 40rem;
  }
  .t-admin-actions {
    display: flex;
    gap: var(--t-space-2);
  }
  .t-admin-error {
    color: var(--t-color-danger);
  }
</style>
