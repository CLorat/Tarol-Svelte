<script lang="ts">
  import Code from './Code.svelte';
</script>

<h1>Auth with Zitadel</h1>
<Code
  code={`import { createOidc } from '@clorat/tarol-oidc';
import { zitadel } from '@clorat/tarol-oidc/zitadel';

const oidc = createOidc(zitadel({ issuer, clientId, projectId, redirectUri: location.origin + '/', onSignOut: () => client.invalidate() }));
const client = createClient({ baseUrl: '/api', tokens: oidc.provider });

const result = await oidc.handleRedirect();
if (result.kind === 'none' && !oidc.session()) await oidc.restore(); // after a reload: prompt=none`}
/>
<ul>
  <li>Tokens live in memory only; a reload asks Zitadel's session with <code>prompt=none</code>.</li>
  <li>The preset adds the <code>:aud</code> scope; without it every backend call is 401.</li>
  <li><code>oidc.session()?.roles</code> and <code>provider.tenant()</code> match what the backend derives.</li>
</ul>
