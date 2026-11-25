<script lang="ts">
  import { Checkbox } from '@clorat/tarol-design';
  let accepted = $state(false);
</script>

<Checkbox
  label="I accept the terms"
  required
  bind:checked={accepted}
  error={accepted ? undefined : 'Accept the terms to continue.'}
/>
