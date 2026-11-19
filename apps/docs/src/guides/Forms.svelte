<script lang="ts">
  import Code from './Code.svelte';
</script>

<h1>Forms and validation</h1>
<ul>
  <li>Bind fields by the backend's field path: <code>&lt;FormField form path="lines[1].quantity" …&gt;</code>.</li>
  <li>Client rules come from the generated <code>rules</code> (the backend's metadata), with the backend's codes.</li>
  <li>
    The server's 400 lands on the field with the same path; codes such as <code>Auth.Forbidden</code> or
    <code>Stream.VersionConflict</code> go to the form's alert.
  </li>
  <li>A retry of an unchanged input reuses the idempotency key: double clicks are safe.</li>
  <li>Once a field shows an error it is checked while you type.</li>
</ul>
<Code
  code={`const bid = changeForm(requests.placeBid, { auction: id, amount: 0 }, {
  rules: rules.placeBid,
  expectedVersion: () => view.version,                       // If-Match: a concurrent change is a 409
  optimistic: (i) => view.patch((a) => ({ ...a, bids: a.bids + 1 })), // shown at once, rolled back on failure
});`}
/>
