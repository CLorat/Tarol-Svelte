<script lang="ts">
  import Code from './Code.svelte';
  import { app, form, install, main } from './first-screen.js';
</script>

<h1>A first screen in minutes</h1>
<p>A list of auctions and a create form against a Tarol backend, in four steps.</p>
<h2>1. Generate the typed client</h2>
<Code code={install} />
<h2>2. One client, one context</h2>
<Code code={main} />
<h2>3. The shell and the list</h2>
<Code code={app} />
<h2>4. The create form</h2>
<Code code={form} />
<p>
  The list revalidates after the create by itself (own changes are read back with <code>Tarol-Read-After</code>). The
  <a href="#/auctions">ArtFlow example</a> is this screen against the running sample.
</p>
