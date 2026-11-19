<!--
  @component
  A placeholder with a fixed size, so content that arrives later does not shift the layout (philosophy P1).
-->
<script lang="ts">
  interface Props {
    /** Width, any CSS length. Default `100%`. */
    width?: string | undefined;
    /** Height, any CSS length. Default `1em`. */
    height?: string | undefined;
  }
  let { width = '100%', height = '1em' }: Props = $props();
</script>

<span class="t-skeleton" style:width style:height aria-hidden="true"></span>

<style>
  .t-skeleton {
    display: block;
    border-radius: var(--t-radius-1);
    background: var(--t-color-bg-muted);
  }
</style>
