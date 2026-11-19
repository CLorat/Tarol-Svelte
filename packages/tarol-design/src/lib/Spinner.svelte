<!--
  @component
  A loading indicator. Decorative by default (`label` omitted); with a `label` it is announced as a status.
-->
<script lang="ts">
  interface Props {
    /** The size, any CSS length. Default `1.25rem`. */
    size?: string | undefined;
    /** Announced text; without it the spinner is hidden from assistive technology. */
    label?: string | undefined;
  }
  let { size = '1.25rem', label }: Props = $props();
</script>

<span
  class="t-spinner"
  style:width={size}
  style:height={size}
  role={label ? 'status' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
></span>

<style>
  .t-spinner {
    display: inline-block;
    flex: none;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: t-spin 0.7s linear infinite;
  }
  @keyframes t-spin {
    to {
      transform: rotate(1turn);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .t-spinner {
      animation-duration: 2.8s;
    }
  }
</style>
