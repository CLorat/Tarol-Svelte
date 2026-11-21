<!-- Task 3, a create form with the server's rules (client-side from x-tarol-rules, server errors on the same field). -->
<script lang="ts">
  import type { Created } from '@clorat/tarol-client';
  import { ChangeForm, FormField } from '@clorat/tarol-components';
  import { changeForm } from '@clorat/tarol-svelte';
  import { requests, rules } from '../artflow/api.js';

  const { onCreated }: { onCreated: (id: string) => void } = $props();
  const create = changeForm<{ reserve: number | null }, Created>(
    (i) => requests.createAuction({ reserve: i.reserve ?? 0 }),
    { reserve: null },
    { rules: rules.createAuction, onSuccess: (r) => { onCreated(r.value.id); } },
  );
</script>

<ChangeForm form={create} submitLabel="Create auction">
  <FormField form={create} path="reserve" label="Reserve (EUR)" type="number" rules={rules.createAuction.reserve} />
</ChangeForm>
