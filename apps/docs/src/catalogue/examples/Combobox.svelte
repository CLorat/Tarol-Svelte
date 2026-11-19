<script lang="ts">
  import { Combobox } from '@clorat/tarol-design';
  const artists = [
    { value: 'monet', label: 'Claude Monet' },
    { value: 'morisot', label: 'Berthe Morisot' },
    { value: 'manet', label: 'Édouard Manet' },
    { value: 'cassatt', label: 'Mary Cassatt' },
  ];
  let artist = $state<string | null>(null);
</script>

<Combobox label="Artist" options={artists} bind:value={artist} />
<p>Value: {JSON.stringify(artist)}</p>
