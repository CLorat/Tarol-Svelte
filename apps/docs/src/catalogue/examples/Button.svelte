<script lang="ts">
  import { Button } from '@clorat/tarol-design';
  let saving = $state(false);
</script>

<Button
  onclick={() => {
    saving = true;
    setTimeout(() => (saving = false), 1000);
  }}
  loading={saving}
>
  Save
</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>
