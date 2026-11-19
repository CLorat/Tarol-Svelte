<script lang="ts">
  import { Field } from '@clorat/tarol-design';
  let colour = $state('#2753d6');
</script>

<Field label="Accent colour" hint="Any custom control gets the label, hint and error wiring">
  {#snippet control(c)}<input {...c} type="color" bind:value={colour} />{/snippet}
</Field>
