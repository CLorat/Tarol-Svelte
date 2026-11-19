<script lang="ts">
  import { TextField } from '@clorat/tarol-design';
  let title = $state('Ir');
</script>

<TextField
  label="Title"
  hint="3 to 80 characters"
  required
  bind:value={title}
  error={title.length < 3 ? 'Enter between 3 and 80 characters.' : undefined}
/>
