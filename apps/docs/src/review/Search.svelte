<!-- Task 5, a search box over GET /search: debounced, aborted, highlighted. -->
<script lang="ts">
  import { SearchBox } from '@clorat/tarol-components';

  const { go }: { go: (path: string) => void } = $props();
</script>

<SearchBox label="Search" onselect={(hit) => { go(`#/auctions/${hit.aggregate}`); }} />
