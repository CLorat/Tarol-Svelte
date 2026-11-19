<script lang="ts">
  import { ChangeForm, FormField } from '@clorat/tarol-components';
  import { changeForm, type Rule } from '@clorat/tarol-svelte';

  const rules: Record<string, readonly Rule[]> = { amount: [{ rule: 'Required', code: 'Required' }] };
  // the demo backend refuses a bid below 100 with 400 { amount: ['Range'] }
  const bid = changeForm(
    (i: { amount: number | null }) => ({ method: 'POST', path: '/auctions/demo/bids', body: i }),
    { amount: 50 },
    { rules },
  );
</script>

<ChangeForm form={bid} submitLabel="Bid">
  <FormField form={bid} path="amount" label="Amount (EUR)" type="number" rules={rules['amount']} />
</ChangeForm>
