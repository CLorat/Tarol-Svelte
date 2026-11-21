<!-- Task 4, an optimistic change: the bid counts at once; any refusal rolls it back and reads again. -->
<script lang="ts">
  import { ChangeForm, FormField } from '@clorat/tarol-components';
  import { changeForm, query } from '@clorat/tarol-svelte';
  import { requests, rules, type AuctionId, type AuctionView } from '../artflow/api.js';

  const { id }: { id: AuctionId } = $props();
  const view = query<AuctionView>(() => requests.auctionView({ auction: id }));
  const bid = changeForm<{ amount: number | null }>(
    (i) => requests.placeBid({ auction: id, amount: i.amount ?? 0 }),
    { amount: null },
    {
      rules: rules.placeBid,
      expectedVersion: () => view.version,
      optimistic: () => view.patch((a) => ({ ...a, bids: a.bids + 1 })),
    },
  );
</script>

<p>{view.value?.bids} bids</p>
<ChangeForm form={bid} submitLabel="Bid">
  <FormField form={bid} path="amount" label="Amount (EUR)" type="number" rules={rules.placeBid.amount} />
</ChangeForm>
