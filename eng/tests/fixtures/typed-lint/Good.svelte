<!-- The recipe: shared types from a .ts module, the parameter of an app component's callback annotated; the packages'
     components are typed through their .svelte.d.ts, so their callbacks need no annotation. -->
<script lang="ts">
  import { MenuButton, Tabs, type MenuItem, type TabItem } from '../../../../packages/tarol-design/dist/index.js';
  import { SearchBox } from '../../../../packages/tarol-components/dist/index.js';
  import type { Sent } from './sent.js';
  import Typed from './Typed.svelte';

  let last = $state('');
  const items: readonly MenuItem[] = [{ id: 'archive', label: 'Archive' }];
  const tabs: readonly TabItem[] = [{ id: 'a', label: 'A' }];
  // the packages' item types, for an app's own helpers (exported since round 3)
  const labels = (list: readonly (MenuItem | TabItem)[]): string => list.map((i) => i.label).join();
</script>

<Typed onSent={(c: Sent) => (last = c.id)} />
<MenuButton {items} onselect={(id) => (last = id.toUpperCase())}>{last}{labels(items)}</MenuButton>
<SearchBox label="Search" onselect={(hit) => (last = hit.title)} />
<Tabs label="Tabs" {tabs} onchange={(id) => (last = id)}>
  {#snippet children(id)}{id}{/snippet}
</Tabs>
