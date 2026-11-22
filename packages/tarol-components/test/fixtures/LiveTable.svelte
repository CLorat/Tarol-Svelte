<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { list, setTarol, type List } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { DataTable, type Column } from '../../src/lib/index.js';
  import type { Row } from '../fake.js';

  const props: { client: TarolClient; expose: (l: List<Row>) => void } = $props();
  setTarol(untrack(() => props.client));
  const auctions = list<Row>(() => ({ path: '/auctions', query: { limit: 5 } }), { revalidateOnFocus: false });
  untrack(() => props.expose(auctions));
  const columns: Column[] = [
    { key: 'title', header: 'Title' },
    { key: 'bids', header: 'Bids', align: 'end' },
  ];
</script>

<DataTable list={auctions} {columns} caption="Auctions" rowKey={(r: Row) => r.id}>
  {#snippet cell(row: Row, c: Column)}{c.key === 'title' ? row.title : row.bids}{/snippet}
</DataTable>
