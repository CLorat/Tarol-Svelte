<!--
  @component
  The admin UI over Tarol's admin entry (`MapTarolAdmin`): dead letters (re-drive, discard), projection versions (drop a
  superseded one) and a data subject (export, erase). Mount it on a route of your app inside `ThemeRoot`, after
  `setTarol(client)`; the user needs the backend's admin role (`tarol-admin` in the sample), else every section shows the
  403 `Auth.Forbidden` message. It adds no global state; its texts come from `messages` (default `adminEn`) in front of
  the app's catalogue.
-->
<script lang="ts">
  import { getMessages, setMessages, Tabs, translator, type Catalogue } from '@clorat/tarol-design';
  import { untrack } from 'svelte';
  import DataSubject from './DataSubject.svelte';
  import DeadLetters from './DeadLetters.svelte';
  import { adminEn } from './messages.js';
  import Projections from './Projections.svelte';

  interface Props {
    /** Where the backend mapped the admin entry. Default `/tarol/admin`. */
    prefix?: string | undefined;
    /** The admin texts and codes, e.g. `adminDe`. Default `adminEn`. */
    messages?: Catalogue | undefined;
    /** The tenant the data-subject section starts with. Default the empty GUID (data without a tenant). */
    tenant?: string | undefined;
    /** The open section (bindable): `dead`, `projections` or `subject`. */
    section?: string | undefined;
  }

  let { prefix = '/tarol/admin', messages = adminEn, tenant, section = $bindable() }: Props = $props();
  const parent = getMessages();
  const own = untrack(() => messages);
  const mine = translator(own);
  // the admin catalogue first, the app's for everything else (Auth.Forbidden, ui.*)
  const t = setMessages((id, params) => (id in own ? mine(id, params) : parent(id, params)));
</script>

<Tabs
  label={t('admin.sections')}
  tabs={[
    { id: 'dead', label: t('admin.deadLetters') },
    { id: 'projections', label: t('admin.projections') },
    { id: 'subject', label: t('admin.subject') },
  ]}
  bind:selected={section}
>
  {#snippet children(id)}
    {#if id === 'dead'}<DeadLetters {prefix} />{:else if id === 'projections'}<Projections
        {prefix}
      />{:else}<DataSubject {prefix} {tenant} />{/if}
  {/snippet}
</Tabs>
