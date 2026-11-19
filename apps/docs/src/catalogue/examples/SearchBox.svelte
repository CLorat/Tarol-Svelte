<script lang="ts">
  import { SearchBox, type SearchHit } from '@clorat/tarol-components';
  let opened = $state<SearchHit | null>(null);
</script>

<SearchBox label="Search auctions" onselect={(hit) => (opened = hit)} />
<p>Opened: {opened?.title ?? '—'}</p>
