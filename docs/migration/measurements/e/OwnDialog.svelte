<script>
  let { open = $bindable(false), title, children } = $props();
  let d; let opener;
  $effect(() => { if (open && !d.open) { opener = document.activeElement; d.showModal(); } else if (!open && d.open) { d.close(); } });
</script>
<dialog bind:this={d} aria-labelledby="t" onclose={() => { open = false; opener?.focus(); }} onclick={(e) => e.target === d && d.close()}>
  <h2 id="t">{title}</h2>{@render children?.()}<button onclick={() => d.close()} aria-label="Close">×</button>
</dialog>
