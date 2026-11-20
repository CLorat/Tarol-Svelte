<!--
  @component
  The projection versions with their state, rows and size; a superseded version can be dropped after a confirmation (the
  backend refuses the current one with `Projection.Drop`).
-->
<script lang="ts">
  import { getTarol, query } from '@clorat/tarol-svelte';
  import { QueryState } from '@clorat/tarol-components';
  import { Button, Dialog, getMessages, getToasts } from '@clorat/tarol-design';
  import { requests, type ProjectionVersion } from './api.js';
  import { refusal, under } from './entry.js';

  interface Props {
    /** Where the backend mapped the admin entry. */
    prefix: string;
  }

  let { prefix }: Props = $props();
  const { client } = getTarol();
  const t = getMessages();
  const toasts = getToasts();
  const versions = query<ProjectionVersion[]>(() => under(prefix, requests.tarolAdminProjections()));
  let dropping = $state<ProjectionVersion>();

  async function drop(): Promise<void> {
    const p = dropping;
    dropping = undefined;
    if (!p) return;
    const r = await client.change(
      under(prefix, requests.tarolAdminDropProjection({ name: p.name, version: p.version })),
    );
    if (r.ok) toasts.show(t('admin.dropped'), { kind: 'success' });
    else toasts.show(refusal(t, r), { kind: 'error' });
    await versions.refresh();
  }
</script>

<QueryState state={versions}>
  <table class="t-admin-table">
    <caption>{t('admin.projections')}</caption>
    <thead>
      <tr>
        <th scope="col">{t('admin.name')}</th>
        <th scope="col">{t('admin.version')}</th>
        <th scope="col">{t('admin.state')}</th>
        <th scope="col">{t('admin.rows')}</th>
        <th scope="col">{t('admin.bytes')}</th>
        <th scope="col">{t('admin.actions')}</th>
      </tr>
    </thead>
    <tbody>
      {#each versions.value ?? [] as v (`${v.name} ${String(v.version)}`)}
        <tr>
          <td>{v.name}</td>
          <td>{v.version}</td>
          <td>{v.state}</td>
          <td>{v.rows}</td>
          <td>{v.bytes}</td>
          <td>
            {#if v.superseded}<Button variant="danger" onclick={() => (dropping = v)}>
                {t('admin.drop', { name: v.name, version: v.version })}
              </Button>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</QueryState>

<Dialog open={dropping !== undefined} title={t('admin.projections')} onclose={() => (dropping = undefined)}>
  <p>{dropping ? t('admin.confirmDrop', { name: dropping.name, version: dropping.version }) : ''}</p>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (dropping = undefined)}>{t('admin.cancel')}</Button>
    <Button variant="danger" onclick={() => void drop()}>{t('admin.confirm')}</Button>
  {/snippet}
</Dialog>

<style>
  .t-admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--t-text-sm);
  }
  .t-admin-table caption {
    text-align: start;
  }
  .t-admin-table th,
  .t-admin-table td {
    padding: var(--t-space-2) var(--t-space-3);
    border-block-end: 1px solid var(--t-color-border);
    text-align: start;
  }
</style>
