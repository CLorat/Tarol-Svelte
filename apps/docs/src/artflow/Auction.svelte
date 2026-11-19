<script lang="ts">
  import { DetailLayout, ChangeForm, FormField } from '@clorat/tarol-components';
  import { getMessages, getToasts, MenuButton } from '@clorat/tarol-design';
  import { changeForm, getTarol, query } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { requests, rules, tarol, type AuctionView } from './api.js';
  import { euros, short } from './format.js';

  const props: { id: string } = $props();
  const id = untrack(() => props.id);
  const t = getMessages();
  const toasts = getToasts();
  const api = tarol(getTarol().client);
  const view = query<AuctionView>(() => requests.auctionView({ auction: id }));
  const bid = changeForm<{ auction: string; amount: number | null }>(
    (i) => requests.placeBid({ auction: i.auction, amount: i.amount ?? 0 }),
    { auction: id, amount: null },
    {
      rules: rules.placeBid,
      expectedVersion: () => view.version,
      // the bid counts at once; a refusal (403, 409 …) takes it back
      optimistic: () => view.patch((a) => ({ ...a, bids: a.bids + 1 })),
      onSuccess: () => {
        toasts.show('Bid placed.', { kind: 'success' });
      },
    },
  );

  async function act(action: string): Promise<void> {
    if (action !== 'settle') return;
    const r = await api.changes.settleAuction({ auction: id });
    if (r.ok) toasts.show('Auction settled.', { kind: 'success' });
    else toasts.show(t(r.violation.kind === 'error' ? r.violation.code : 'error.generic'), { kind: 'error' });
  }
</script>

<DetailLayout query={view} title={(a: AuctionView) => `Auction ${short(a.id)}`}>
  {#snippet meta(a: AuctionView)}
    <span>Reserve {euros(a.reserve)}</span> ·
    <span data-testid="bids">{a.bids} {a.bids === 1 ? 'bid' : 'bids'}</span> ·
    <span>{a.settled ? 'settled' : 'open'}</span>
  {/snippet}
  {#snippet actions()}
    <MenuButton items={[{ id: 'settle', label: 'Settle' }]} onselect={(a) => void act(a)}>Actions</MenuButton>
  {/snippet}
  {#snippet children(a: AuctionView)}
    <h2>Place a bid on auction {short(a.id)}</h2>
    <ChangeForm form={bid} submitLabel="Bid">
      <FormField form={bid} path="amount" label="Amount (EUR)" type="number" rules={rules.placeBid.amount} />
    </ChangeForm>
  {/snippet}
  {#snippet aside(a: AuctionView)}
    <h2>Seller</h2>
    <p>{a.seller}</p>
  {/snippet}
</DetailLayout>
