<script lang="ts">
  import { MenuButton } from '@clorat/tarol-design';
  let chosen = $state('');
</script>

<MenuButton
  items={[
    { id: 'edit', label: 'Edit' },
    { id: 'archive', label: 'Archive', disabled: true },
    { id: 'delete', label: 'Delete' },
  ]}
  onselect={(id) => (chosen = id)}
>
  Actions
</MenuButton>
<p>Chosen: {chosen}</p>
