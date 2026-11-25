<!-- An app's own component: its types live in <script module>, its callback has a typed parameter. -->
<script module lang="ts">
  export interface Sent {
    id: string;
  }
</script>

<script lang="ts">
  interface Props {
    onSent: (sent: Sent) => void;
  }
  let { onSent }: Props = $props();
</script>

<button
  type="button"
  onclick={() => {
    onSent({ id: 'a' });
  }}
>
  x
</button>
