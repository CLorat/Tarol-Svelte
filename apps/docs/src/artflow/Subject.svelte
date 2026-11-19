<script lang="ts">
  import { Button, getMessages, getToasts } from '@clorat/tarol-design';
  import { QueryState } from '@clorat/tarol-components';
  import { getTarol, query } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';

  /** The admin export of a data subject (`GET {admin}/subjects/{id}/export?tenant=`, Tarol.Operations). */
  interface Export {
    subject: string;
    states: { streamType: string; state: Record<string, unknown> }[];
  }

  const props: { id: string; tenant: string } = $props();
  const { id, tenant } = untrack(() => props);
  const t = getMessages();
  const toasts = getToasts();
  const { client } = getTarol();
  const subject = query<Export>(() => ({ path: `/tarol/admin/subjects/${encodeURIComponent(id)}/export`, query: { tenant } }));
  const personal = ['name', 'email'];
  let erasing = $state(false);

  async function erase(): Promise<void> {
    erasing = true;
    try {
      const path = `/tarol/admin/subjects/${encodeURIComponent(id)}/erase?tenant=${encodeURIComponent(tenant)}`;
      const r = await client.change({ method: 'POST', path });
      if (r.ok) toasts.show('Personal data erased.', { kind: 'success' });
      else toasts.show(t(r.violation.kind === 'error' ? r.violation.code : 'error.generic'), { kind: 'error' });
      await subject.refresh();
    } finally {
      erasing = false;
    }
  }
</script>

<h1>Data subject</h1>
<QueryState state={subject}>
  {#each subject.value?.states ?? [] as s (s.streamType)}
    <h2>{s.streamType}</h2>
    <dl>
      {#each personal as field (field)}
        <dt>{field}</dt>
        <dd data-testid="field-{field}">
          {#if typeof s.state[field] === 'string'}{s.state[field]}{:else}<em>{t('ui.erased')}</em>{/if}
        </dd>
      {/each}
    </dl>
  {/each}
  <Button variant="danger" loading={erasing} onclick={() => void erase()}>Erase personal data</Button>
</QueryState>
