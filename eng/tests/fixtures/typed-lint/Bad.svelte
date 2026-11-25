<!-- Tatalu FB-F05.1-4 and FB-INT3-6: what typed lint cannot see. -->
<script lang="ts">
  import Local, { type Sent } from './Local.svelte';

  let last = $state('');
  const pick = (s: Sent): string => s.id;
</script>

<Local onSent={(c) => (last = c.id)} />
<Local onSent={(c) => (last = pick(c))} />
{last}
